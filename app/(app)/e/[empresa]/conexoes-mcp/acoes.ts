"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { podeFecharMes } from "@/lib/papel";
import { ehPedidoDeConexao } from "@/lib/rotas";
import { contaDaSessao } from "../../../../(auth)/acoes";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * A conexão do ChatGPT e do Claude com o Ledgr (backend #136, front #195): o Ledgr é o servidor de
 * autorização do OAuth, e o consentimento é a tela `/autorizar-conexao`. Autorizar e ver ou revogar as
 * conexões é do admin e do gestor; recusar, de quem estiver na tela. Com `MCP_HABILITADO` desligado o
 * backend responde 404 em tudo, e as telas se escondem.
 */

export type PedidoDeConexao = {
  cliente: string;
  /** De onde vem o pedido (o host do redirect_uri); loopback é qualquer programa da máquina. */
  origem: { host: string; loopback: boolean };
  descricaoEscopo: string;
  expiraEm: string;
  empresas: { id: string; razaoSocial: string; cnpj: string }[];
};

type PedidoAPI = {
  cliente: string;
  origem: { host: string; loopback: boolean };
  escopo: string;
  descricao_escopo: string;
  expira_em: string;
  empresas: { id: string; razao_social: string; cnpj: string }[];
};

export type ConexaoMcp = {
  id: string;
  cliente: string;
  empresa: { id: string; razaoSocial: string };
  criadaPor: string | null;
  criadoEm: string;
  ultimoUsoEm: string | null;
  revogadaEm: string | null;
};

type ConexaoAPI = {
  id: string;
  cliente: string;
  empresa: { id: string; razao_social: string };
  criada_por: string | null;
  criado_em: string;
  ultimo_uso_em: string | null;
  revogada_em: string | null;
};

const SO_ADMIN_OU_GESTOR_CONECTA = "Só o admin ou o gestor da conta autorizam conexões com assistentes de IA.";
const PEDIDO_VENCIDO = "Este pedido de conexão não vale mais. Volte ao ChatGPT ou ao Claude e conecte de novo.";
const PEDIDO_INVALIDO: Falha = { ok: false, status: 404, erro: PEDIDO_VENCIDO };

function traduzir(erro: unknown, aoPedir = false): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 403) return { ok: false, status, erro: SO_ADMIN_OU_GESTOR_CONECTA };
  // no pedido, o 404 é o pedido vencido ou já usado; o da empresa (de outra conta) vira 422, para a tela
  // pedir outra empresa em vez de dar o pedido por perdido
  if (aoPedir && status === 404 && erro.detalhe === "Empresa não encontrada.") return { ok: false, status: 422, erro: erro.detalhe };
  if (aoPedir && status === 404) return { ok: false, status, erro: PEDIDO_VENCIDO };
  if (status === 429) return { ok: false, status, erro: "Muitas tentativas. Espere um minuto e tente de novo." };
  if (status === 503) return { ok: false, status, erro: "A conexão com assistentes de IA está indisponível no momento." };
  // 409 (10 conexões ativas), 402 (plano) e o 404 da conexão chegam com o texto do backend
  return { ok: false, status, erro: erro.detalhe };
}

/** O backend devolve o redirect_uri do cliente; o navegador só vai a ele se for http(s). */
function destinoSeguro(destino: unknown): string | null {
  if (typeof destino !== "string") return null;
  try {
    const url = new URL(destino);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function recusaQuemNaoConecta(): Promise<Falha | null> {
  const { papel } = await contaDaSessao();
  if (!podeFecharMes(papel)) return { ok: false, status: 403, erro: SO_ADMIN_OU_GESTOR_CONECTA };
  if (ehContaDeDemonstracao(await emailDaSessao())) return { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO };
  return null;
}

export async function carregarPedidoDeConexao(pedido: string): Promise<Resultado<PedidoDeConexao>> {
  if (!ehPedidoDeConexao(pedido)) return PEDIDO_INVALIDO;
  try {
    const dados = await chamarBackend<PedidoAPI>(`/conexoes-mcp/pedidos/${pedido}`);
    return {
      ok: true,
      dados: {
        cliente: dados.cliente,
        origem: { host: dados.origem.host, loopback: dados.origem.loopback },
        descricaoEscopo: dados.descricao_escopo,
        expiraEm: dados.expira_em,
        empresas: dados.empresas.map((empresa) => ({ id: empresa.id, razaoSocial: empresa.razao_social, cnpj: empresa.cnpj })),
      },
    };
  } catch (erro) {
    return traduzir(erro, true);
  }
}

/** Autoriza o pedido para uma empresa e devolve para onde mandar o navegador (o cliente, com o código). */
export async function autorizarConexao(pedido: string, empresaId: string): Promise<Resultado<{ destino: string }>> {
  if (!ehPedidoDeConexao(pedido)) return PEDIDO_INVALIDO;
  if (!pareceUuid(empresaId)) return { ok: false, status: 422, erro: "Escolha a empresa que a conexão vai ler." };
  const recusa = await recusaQuemNaoConecta();
  if (recusa) return recusa;
  try {
    const resposta = await chamarBackend<{ redirecionar_para: string }>(`/conexoes-mcp/pedidos/${pedido}/aprovar`, {
      method: "POST",
      corpo: { empresa_id: empresaId },
    });
    const destino = destinoSeguro(resposta.redirecionar_para);
    if (!destino) return { ok: false, status: 502, erro: "O endereço de volta do assistente não é válido." };
    return { ok: true, dados: { destino } };
  } catch (erro) {
    return traduzir(erro, true);
  }
}

/** Recusa o pedido (qualquer papel): o cliente recebe `access_denied`. */
export async function recusarConexao(pedido: string): Promise<Resultado<{ destino: string }>> {
  if (!ehPedidoDeConexao(pedido)) return PEDIDO_INVALIDO;
  try {
    const resposta = await chamarBackend<{ redirecionar_para: string }>(`/conexoes-mcp/pedidos/${pedido}/recusar`, {
      method: "POST",
    });
    const destino = destinoSeguro(resposta.redirecionar_para);
    if (!destino) return { ok: false, status: 502, erro: "O endereço de volta do assistente não é válido." };
    return { ok: true, dados: { destino } };
  } catch (erro) {
    return traduzir(erro, true);
  }
}

/** As conexões da conta, ativas e revogadas. Um 404 é a conexão desligada no backend (ou um backend antes do #136). */
export async function carregarConexoesMcp(): Promise<Resultado<{ itens: ConexaoMcp[]; endereco: string | null }>> {
  const { papel } = await contaDaSessao();
  if (!podeFecharMes(papel)) return { ok: false, status: 403, erro: SO_ADMIN_OU_GESTOR_CONECTA };
  try {
    const lista = await chamarBackend<{ itens: ConexaoAPI[] }>("/conexoes-mcp");
    return {
      ok: true,
      dados: {
        itens: lista.itens.map((conexao) => ({
          id: conexao.id,
          cliente: conexao.cliente,
          empresa: { id: conexao.empresa.id, razaoSocial: conexao.empresa.razao_social },
          criadaPor: conexao.criada_por,
          criadoEm: conexao.criado_em,
          ultimoUsoEm: conexao.ultimo_uso_em,
          revogadaEm: conexao.revogada_em,
        })),
        // shortcut: o conector fica em `/mcp` do mesmo backend (o `MCP_URL_PUBLICA` padrão); se o backend
        // mudar o caminho ou o host, este passa a ser uma variável própria
        endereco: process.env.LEDGR_API_URL ? `${process.env.LEDGR_API_URL.replace(/\/+$/, "")}/mcp` : null,
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Revoga na hora, com todos os tokens dela. 204 mesmo se já estava revogada. */
export async function revogarConexaoMcp(id: string): Promise<Resultado<null>> {
  if (!pareceUuid(id)) return { ok: false, status: 404, erro: "Conexão não encontrada." };
  const recusa = await recusaQuemNaoConecta();
  if (recusa) return recusa;
  try {
    await chamarBackend<null>(`/conexoes-mcp/${id}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}

"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend } from "@/lib/backend";
import type { Falha, Resultado } from "../../(app)/e/[empresa]/conciliacoes/acoes";

/**
 * O painel interno do Ledgr (backend #156/PR #176, front #222, parte 1): quem opera o produto vê as contas
 * clientes, o uso de cada uma e inativa, reativa ou marca como piloto. Quem é operador o backend decide a
 * cada chamada (tabela própria, nunca o papel da conta, nunca o JWT): quem não é recebe 403, e a tela
 * responde 404 como se `/admin` não existisse. As rotas ignoram a empresa ativa. Cupom, pagamentos e
 * vencimentos são a parte 2 (#236).
 */

export const SITUACOES = ["sem_plano", "teste", "teste_encerrado", "ativo", "inativa"] as const;
export const ROTULO_DA_SITUACAO: Record<string, string> = {
  sem_plano: "Sem plano",
  teste: "Em teste",
  teste_encerrado: "Teste encerrado",
  ativo: "Ativa",
  inativa: "Inativa",
};

export type ContaDoPainel = {
  id: string;
  razaoSocial: string;
  cnpj: string;
  plano: string | null;
  situacao: string;
  testeTerminaEm: string | null;
  assinaturaAtiva: boolean;
  inativa: boolean;
  criadaEm: string;
};

export type ListaDeContas = { total: number; limit: number; offset: number; itens: ContaDoPainel[] };

export type DetalheDaConta = ContaDoPainel & {
  admin: { nome: string; email: string } | null;
  inativacao: { em: string; motivo: string } | null;
  ultimoLoginEm: string | null;
  uso: {
    empresas: number;
    usuariosAtivos: number;
    convitesPendentes: number;
    conciliacoesTotal: number;
    /** Extratos do banco conciliados pela primeira vez em cada mês ("AAAA-MM"): a unidade de cobrança. */
    extratosDoBancoPorMes: { mes: string; extratos: number }[];
    chavesApiAtivas: number;
    conexoesMcpAtivas: number;
    linksPublicosAtivos: number;
  };
  eventos: { tipo: string; motivo: string; operador: string | null; origem: string; em: string }[];
};

type ContaAPI = {
  id: string;
  razao_social: string;
  cnpj: string;
  plano: string | null;
  situacao: string;
  teste_termina_em: string | null;
  assinatura_ativa: boolean;
  inativa: boolean;
  criada_em: string;
};

type DetalheAPI = ContaAPI & {
  admin: { nome: string; email: string } | null;
  inativacao: { em: string; motivo: string } | null;
  ultimo_login_em: string | null;
  uso: {
    empresas: number;
    usuarios_ativos: number;
    convites_pendentes: number;
    conciliacoes_total: number;
    extratos_do_banco_por_mes: { mes: string; extratos_do_banco: number }[];
    chaves_api_ativas: number;
    conexoes_mcp_ativas: number;
    links_publicos_ativos: number;
  };
  eventos: DetalheDaConta["eventos"];
};

export const POR_PAGINA = 20;

function conta(c: ContaAPI): ContaDoPainel {
  return {
    id: c.id,
    razaoSocial: c.razao_social,
    cnpj: c.cnpj,
    plano: c.plano,
    situacao: c.situacao,
    testeTerminaEm: c.teste_termina_em,
    assinaturaAtiva: c.assinatura_ativa,
    inativa: c.inativa,
    criadaEm: c.criada_em,
  };
}

function detalhe(d: DetalheAPI): DetalheDaConta {
  return {
    ...conta(d),
    admin: d.admin,
    inativacao: d.inativacao,
    ultimoLoginEm: d.ultimo_login_em,
    uso: {
      empresas: d.uso.empresas,
      usuariosAtivos: d.uso.usuarios_ativos,
      convitesPendentes: d.uso.convites_pendentes,
      conciliacoesTotal: d.uso.conciliacoes_total,
      extratosDoBancoPorMes: d.uso.extratos_do_banco_por_mes.map((m) => ({ mes: m.mes, extratos: m.extratos_do_banco })),
      chavesApiAtivas: d.uso.chaves_api_ativas,
      conexoesMcpAtivas: d.uso.conexoes_mcp_ativas,
      linksPublicosAtivos: d.uso.links_publicos_ativos,
    },
    eventos: d.eventos,
  };
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 429) return { ok: false, status, erro: "Muitas chamadas seguidas. Espere um minuto e tente de novo." };
  if (status === 422) return { ok: false, status, erro: "O motivo precisa ter de 1 a 500 caracteres." };
  // 401 (login com mais de 2 horas), 403 (não é operador), 404 e 409 chegam com o texto do backend
  return { ok: false, status, erro: erro.detalhe };
}

export async function listarContas(filtros: {
  busca?: string;
  situacao?: string;
  ordem?: string;
  pagina?: number;
}): Promise<Resultado<ListaDeContas>> {
  const consulta = new URLSearchParams();
  const busca = filtros.busca?.trim().slice(0, 100);
  if (busca) consulta.set("busca", busca);
  if (filtros.situacao && (SITUACOES as readonly string[]).includes(filtros.situacao)) consulta.set("situacao", filtros.situacao);
  if (filtros.ordem === "teste_termina_em") consulta.set("ordem", "teste_termina_em");
  const pagina = Math.max(1, Math.floor(filtros.pagina ?? 1) || 1);
  consulta.set("limit", String(POR_PAGINA));
  consulta.set("offset", String((pagina - 1) * POR_PAGINA));
  try {
    const r = await chamarBackend<{ total: number; limit: number; offset: number; itens: ContaAPI[] }>(`/admin/contas?${consulta}`);
    return { ok: true, dados: { total: r.total, limit: r.limit, offset: r.offset, itens: r.itens.map(conta) } };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function detalharConta(id: string): Promise<Resultado<DetalheDaConta>> {
  if (!pareceUuid(id)) return { ok: false, status: 404, erro: "Conta não encontrada." };
  try {
    return { ok: true, dados: detalhe(await chamarBackend<DetalheAPI>(`/admin/contas/${id}`)) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type AcaoDaConta = "inativar" | "reativar" | "piloto-ligar" | "piloto-desligar";

/** Inativar, reativar e marcar piloto: cada uma com o motivo, que fica no histórico da conta (409 se já está assim). */
export async function agirNaConta(id: string, acao: AcaoDaConta, motivo: string): Promise<Resultado<DetalheDaConta>> {
  const limpo = typeof motivo === "string" ? motivo.trim() : "";
  if (limpo.length < 1 || limpo.length > 500) return { ok: false, status: 422, erro: "O motivo precisa ter de 1 a 500 caracteres." };
  if (!pareceUuid(id)) return { ok: false, status: 404, erro: "Conta não encontrada." };
  const [rota, corpo] =
    acao === "inativar" || acao === "reativar"
      ? ([acao, { motivo: limpo }] as const)
      : (["piloto", { ativo: acao === "piloto-ligar", motivo: limpo }] as const);
  try {
    return { ok: true, dados: detalhe(await chamarBackend<DetalheAPI>(`/admin/contas/${id}/${rota}`, { method: "POST", corpo })) };
  } catch (erro) {
    return traduzir(erro);
  }
}

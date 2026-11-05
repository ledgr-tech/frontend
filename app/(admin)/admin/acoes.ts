"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend } from "@/lib/backend";
import { ehUf } from "@/lib/uf";
import type { Falha, Resultado } from "../../(app)/e/[empresa]/conciliacoes/acoes";
import { ROTULO_DA_ORIGEM, dataDoFiltro } from "./cobranca";
import { POR_PAGINA, SITUACOES, UF_NAO_INFORMADA } from "./situacao";

/**
 * O painel interno do Ledgr (backend #156/PR #176, front #222, parte 1): quem opera o produto vê as contas
 * clientes, o uso de cada uma e inativa, reativa ou marca como piloto. Quem é operador o backend decide a
 * cada chamada (tabela própria, nunca o papel da conta, nunca o JWT): quem não é recebe 403, e a tela
 * responde 404 como se `/admin` não existisse. As rotas ignoram a empresa ativa. Cupom, pagamentos e
 * vencimentos são a parte 2 (#236).
 */

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
  /** Null na conta que não informou (backend #184). */
  cidade: string | null;
  uf: string | null;
};

export type ListaDeContas = { total: number; limit: number; offset: number; itens: ContaDoPainel[] };

export type DetalheDaConta = ContaDoPainel & {
  /** Ligado ou desligado pelo último evento de piloto; null quando nenhum aparece nos eventos recentes. */
  piloto: boolean | null;
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
  /** A assinatura da Stripe guardada pelo webhook (#236); null sem nenhuma. */
  assinatura: AssinaturaDaConta | null;
  /** Os 12 pagamentos mais recentes. */
  pagamentos: Pagamento[];
  cupons: CupomEnviado[];
};

export type AssinaturaDaConta = {
  status: string;
  plano: string;
  periodo: string;
  periodoAtualFim: string | null;
  cancelarNoFimDoPeriodo: boolean;
  canceladaEm: string | null;
  motivoCancelamento: string | null;
  origemCancelamento: string | null;
};

export type Pagamento = {
  id: string;
  valorCentavos: number;
  moeda: string;
  status: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  ocorridoEm: string;
};

export type CupomEnviado = {
  id: string;
  cupom: string;
  desconto: string;
  forma: string;
  codigo: string | null;
  expiraEm: string | null;
  emailEnviado: boolean;
  usadoEm: string | null;
  operador: string | null;
  em: string;
};

type AssinaturaAPI = {
  status: string;
  plano: string;
  periodo: string;
  periodo_atual_fim: string | null;
  cancelar_no_fim_do_periodo: boolean;
  cancelada_em: string | null;
  motivo_cancelamento: string | null;
  origem_cancelamento: string | null;
};

type PagamentoAPI = {
  id: string;
  valor_centavos: number;
  moeda: string;
  status: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  ocorrido_em: string;
};

type CupomEnviadoAPI = {
  id: string;
  cupom: string;
  desconto: string;
  forma: string;
  codigo: string | null;
  expira_em: string | null;
  email_enviado: boolean;
  usado_em: string | null;
  operador: string | null;
  em: string;
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
  // ausentes num backend antes do #184
  cidade?: string | null;
  uf?: string | null;
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
  // ausentes num backend antes do #182
  assinatura?: AssinaturaAPI | null;
  pagamentos?: PagamentoAPI[];
  cupons?: CupomEnviadoAPI[];
};

function pagamento(p: PagamentoAPI): Pagamento {
  return {
    id: p.id,
    valorCentavos: p.valor_centavos,
    moeda: p.moeda,
    status: p.status,
    periodoInicio: p.periodo_inicio,
    periodoFim: p.periodo_fim,
    ocorridoEm: p.ocorrido_em,
  };
}

function assinatura(a: AssinaturaAPI): AssinaturaDaConta {
  return {
    status: a.status,
    plano: a.plano,
    periodo: a.periodo,
    periodoAtualFim: a.periodo_atual_fim,
    cancelarNoFimDoPeriodo: a.cancelar_no_fim_do_periodo,
    canceladaEm: a.cancelada_em,
    motivoCancelamento: a.motivo_cancelamento,
    origemCancelamento: a.origem_cancelamento,
  };
}

function cupomEnviado(c: CupomEnviadoAPI): CupomEnviado {
  return {
    id: c.id,
    cupom: c.cupom,
    desconto: c.desconto,
    forma: c.forma,
    codigo: c.codigo,
    expiraEm: c.expira_em,
    emailEnviado: c.email_enviado,
    usadoEm: c.usado_em,
    operador: c.operador,
    em: c.em,
  };
}

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
    cidade: c.cidade ?? null,
    uf: c.uf ?? null,
  };
}

/** A resposta do backend não traz o estado do piloto: vem do evento mais recente (eles chegam do mais novo ao mais antigo). */
function pilotoDosEventos(eventos: { tipo: string }[]): boolean | null {
  const ultimo = eventos.find((e) => e.tipo === "piloto_ligado" || e.tipo === "piloto_desligado");
  return ultimo ? ultimo.tipo === "piloto_ligado" : null;
}

function detalhe(d: DetalheAPI): DetalheDaConta {
  return {
    ...conta(d),
    piloto: pilotoDosEventos(d.eventos),
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
    assinatura: d.assinatura ? assinatura(d.assinatura) : null,
    pagamentos: (d.pagamentos ?? []).map(pagamento),
    cupons: (d.cupons ?? []).map(cupomEnviado),
  };
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 429) return { ok: false, status, erro: "Muitas chamadas seguidas. Espere um minuto e tente de novo." };
  // um 422 de validação de campo é o motivo; o de texto (período invertido) chega como o backend escreveu
  if (status === 422 && erro.campos.length > 0) return { ok: false, status, erro: "O motivo precisa ter de 1 a 500 caracteres." };
  // 401 (login com mais de 2 horas), 403 (não é operador), 404, 409, 502 (Stripe fora) e 503 (cobrança desligada) chegam com o texto do backend
  return { ok: false, status, erro: erro.detalhe };
}

function motivoValido(motivo: string): string | null {
  const limpo = typeof motivo === "string" ? motivo.trim() : "";
  return limpo.length >= 1 && limpo.length <= 500 ? limpo : null;
}

const SEM_MOTIVO: Falha = { ok: false, status: 422, erro: "O motivo precisa ter de 1 a 500 caracteres." };
const SEM_CONTA: Falha = { ok: false, status: 404, erro: "Conta não encontrada." };

function pagina(n: number | undefined): number {
  return Math.max(1, Math.floor(n ?? 1) || 1);
}

/** Os filtros de período (`desde`/`ate`, "AAAA-MM-DD") e a página, comuns às listas de cobrança. */
function consultaDaLista(filtros: { desde?: string; ate?: string; pagina?: number }): URLSearchParams | Falha {
  const desde = dataDoFiltro(filtros.desde);
  const ate = dataDoFiltro(filtros.ate);
  if (desde && ate && desde > ate) return { ok: false, status: 422, erro: "A data inicial é depois da final." };
  const q = new URLSearchParams();
  if (desde) q.set("desde", desde);
  if (ate) q.set("ate", ate);
  q.set("limit", String(POR_PAGINA));
  q.set("offset", String((pagina(filtros.pagina) - 1) * POR_PAGINA));
  return q;
}

export type Lista<T> = { total: number; limit: number; offset: number; itens: T[] };

export type PagamentoDaLista = Pagamento & { contaId: string; razaoSocial: string };

/** Todos os pagamentos (#236): `status=falhou` é a inadimplência. Só o banco, sem chamar a Stripe. */
export async function listarPagamentos(filtros: { status?: string; desde?: string; ate?: string; pagina?: number }): Promise<Resultado<Lista<PagamentoDaLista>>> {
  const q = consultaDaLista(filtros);
  if (!(q instanceof URLSearchParams)) return q;
  if (filtros.status === "paga" || filtros.status === "falhou") q.set("status", filtros.status);
  try {
    const r = await chamarBackend<Lista<PagamentoAPI & { conta_id: string; razao_social: string }>>(`/admin/pagamentos?${q}`);
    return { ok: true, dados: { ...r, itens: r.itens.map((p) => ({ ...pagamento(p), contaId: p.conta_id, razaoSocial: p.razao_social })) } };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** O histórico inteiro de uma conta, do mais recente ao mais antigo; o detalhe da conta traz só os 12 últimos. */
export async function listarPagamentosDaConta(id: string, numero?: number): Promise<Resultado<Lista<Pagamento>>> {
  if (!pareceUuid(id)) return SEM_CONTA;
  const q = new URLSearchParams({ limit: String(POR_PAGINA), offset: String((pagina(numero) - 1) * POR_PAGINA) });
  try {
    const r = await chamarBackend<Lista<PagamentoAPI>>(`/admin/contas/${id}/pagamentos?${q}`);
    return { ok: true, dados: { ...r, itens: r.itens.map(pagamento) } };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type ContasDoGrupo = { contas: number; assinando: number };
export type ContasPorUf = ContasDoGrupo & { ufs: (ContasDoGrupo & { uf: string })[]; naoInformada: ContasDoGrupo };

/** Onde estão os clientes e onde estão assinando (backend #184). "Assinando" é a situação `ativo` do painel. */
export async function contarContasPorUf(): Promise<Resultado<ContasPorUf>> {
  try {
    const r = await chamarBackend<ContasDoGrupo & { ufs: (ContasDoGrupo & { uf: string })[]; nao_informada: ContasDoGrupo }>("/admin/contas/por-uf");
    return { ok: true, dados: { contas: r.contas, assinando: r.assinando, ufs: r.ufs, naoInformada: r.nao_informada } };
  } catch (erro) {
    // num backend antes do #184, "por-uf" cai na rota do detalhe e volta como um id inválido
    if (erro instanceof ErroBackend && erro.status === 422) return { ok: false, status: 422, erro: "A contagem por estado ainda não está disponível neste backend." };
    return traduzir(erro);
  }
}

export type Cancelamento = {
  contaId: string;
  razaoSocial: string;
  situacao: "cancelada" | "agendada";
  plano: string;
  periodo: string;
  status: string;
  data: string;
  periodoAtualFim: string | null;
  motivo: string | null;
  origem: string | null;
};

/** Canceladas e com cancelamento agendado (#236), da mais recente à mais antiga. */
export async function listarCancelamentos(filtros: { situacao?: string; origem?: string; desde?: string; ate?: string; pagina?: number }): Promise<Resultado<Lista<Cancelamento>>> {
  const q = consultaDaLista(filtros);
  if (!(q instanceof URLSearchParams)) return q;
  if (filtros.situacao === "cancelada" || filtros.situacao === "agendada") q.set("situacao", filtros.situacao);
  if (filtros.origem && filtros.origem in ROTULO_DA_ORIGEM) q.set("origem", filtros.origem);
  type CancelamentoAPI = Omit<Cancelamento, "contaId" | "razaoSocial" | "periodoAtualFim" | "motivo" | "origem"> & {
    conta_id: string;
    razao_social: string;
    periodo_atual_fim: string | null;
    motivo_cancelamento: string | null;
    origem_cancelamento: string | null;
  };
  try {
    const r = await chamarBackend<Lista<CancelamentoAPI>>(`/admin/cancelamentos?${q}`);
    return {
      ok: true,
      dados: {
        ...r,
        itens: r.itens.map((c) => ({
          contaId: c.conta_id,
          razaoSocial: c.razao_social,
          situacao: c.situacao,
          plano: c.plano,
          periodo: c.periodo,
          status: c.status,
          data: c.data,
          periodoAtualFim: c.periodo_atual_fim,
          motivo: c.motivo_cancelamento,
          origem: c.origem_cancelamento,
        })),
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type Vencimento = {
  tipo: "assinatura" | "teste";
  contaId: string;
  razaoSocial: string;
  plano: string | null;
  periodo: string | null;
  status: string | null;
  venceEm: string;
  cancelamentoAgendado: boolean;
  inativa: boolean;
};

/** Assinaturas que renovam e testes que terminam nos próximos `dias` (1 a 60), do mais próximo ao mais distante. */
export async function listarVencimentos(filtros: { dias?: number; pagina?: number }): Promise<Resultado<Lista<Vencimento> & { dias: number }>> {
  const dias = Math.min(60, Math.max(1, Math.floor(filtros.dias ?? 7) || 7));
  const q = new URLSearchParams({ dias: String(dias), limit: String(POR_PAGINA), offset: String((pagina(filtros.pagina) - 1) * POR_PAGINA) });
  type VencimentoAPI = {
    tipo: "assinatura" | "teste";
    conta_id: string;
    razao_social: string;
    plano: string | null;
    periodo: string | null;
    status: string | null;
    vence_em: string;
    cancelamento_agendado: boolean;
    inativa: boolean;
  };
  try {
    const r = await chamarBackend<Lista<VencimentoAPI> & { dias: number }>(`/admin/vencimentos?${q}`);
    return {
      ok: true,
      dados: {
        ...r,
        itens: r.itens.map((v) => ({
          tipo: v.tipo,
          contaId: v.conta_id,
          razaoSocial: v.razao_social,
          plano: v.plano,
          periodo: v.periodo,
          status: v.status,
          venceEm: v.vence_em,
          cancelamentoAgendado: v.cancelamento_agendado,
          inativa: v.inativa,
        })),
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Cancela a assinatura da conta na Stripe, no fim do período ou agora (sem reembolso: esse é no painel da Stripe). */
export async function cancelarAssinatura(id: string, quando: "fim_do_periodo" | "agora", motivo: string): Promise<Resultado<DetalheDaConta>> {
  const limpo = motivoValido(motivo);
  if (!limpo) return SEM_MOTIVO;
  if (!pareceUuid(id)) return SEM_CONTA;
  if (quando !== "fim_do_periodo" && quando !== "agora") return { ok: false, status: 422, erro: "Escolha quando cancelar." };
  try {
    return { ok: true, dados: detalhe(await chamarBackend<DetalheAPI>(`/admin/contas/${id}/assinatura/cancelar`, { method: "POST", corpo: { quando, motivo: limpo } })) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Desfaz o cancelamento agendado. */
export async function manterAssinatura(id: string, motivo: string): Promise<Resultado<DetalheDaConta>> {
  const limpo = motivoValido(motivo);
  if (!limpo) return SEM_MOTIVO;
  if (!pareceUuid(id)) return SEM_CONTA;
  try {
    return { ok: true, dados: detalhe(await chamarBackend<DetalheAPI>(`/admin/contas/${id}/assinatura/manter`, { method: "POST", corpo: { motivo: limpo } })) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type CupomDaStripe = { id: string; nome: string; resumo: string };

/** Os cupons válidos da Stripe (o backend guarda 1 minuto); o cupom nasce no painel da Stripe, não aqui. */
export async function listarCupons(): Promise<Resultado<CupomDaStripe[]>> {
  try {
    const r = await chamarBackend<{ id: string; nome: string; resumo: string }[]>("/admin/cupons");
    return { ok: true, dados: r.map((c) => ({ id: c.id, nome: c.nome, resumo: c.resumo })) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type CupomDado = { cupom: string; desconto: string; forma: "codigo" | "assinatura"; codigo: string | null; expiraEm: string | null; emailEnviado: boolean };

/**
 * Dá um cupom à conta: sem assinatura viva vira um código de uso único com validade (mandado por e-mail ao
 * admin da conta); com assinatura viva, o desconto entra direto nela. O código volta sempre, para copiar se o
 * e-mail não saiu.
 */
export async function darCupom(id: string, cupomId: string, validadeDias: number): Promise<Resultado<CupomDado>> {
  if (!pareceUuid(id)) return SEM_CONTA;
  const cupom = typeof cupomId === "string" ? cupomId.trim() : "";
  if (!cupom || cupom.length > 200) return { ok: false, status: 422, erro: "Escolha um cupom." };
  const dias = Math.floor(validadeDias);
  if (!(dias >= 1 && dias <= 90)) return { ok: false, status: 422, erro: "A validade vai de 1 a 90 dias." };
  try {
    const r = await chamarBackend<{ cupom: string; desconto: string; forma: "codigo" | "assinatura"; codigo: string | null; expira_em: string | null; email_enviado: boolean }>(
      `/admin/contas/${id}/cupom`,
      { method: "POST", corpo: { cupom_id: cupom, validade_dias: dias } },
    );
    return { ok: true, dados: { cupom: r.cupom, desconto: r.desconto, forma: r.forma, codigo: r.codigo, expiraEm: r.expira_em, emailEnviado: r.email_enviado } };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function listarContas(filtros: {
  busca?: string;
  situacao?: string;
  ordem?: string;
  uf?: string;
  pagina?: number;
}): Promise<Resultado<ListaDeContas>> {
  const consulta = new URLSearchParams();
  const busca = filtros.busca?.trim().slice(0, 100);
  if (busca) consulta.set("busca", busca);
  if (filtros.situacao && (SITUACOES as readonly string[]).includes(filtros.situacao)) consulta.set("situacao", filtros.situacao);
  if (filtros.ordem === "teste_termina_em") consulta.set("ordem", "teste_termina_em");
  if (filtros.uf && (filtros.uf === UF_NAO_INFORMADA || ehUf(filtros.uf))) consulta.set("uf", filtros.uf);
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

import { PLANOS, type Plano } from "./planos";

/**
 * O plano e o teste de 14 dias da conta, do `GET /me` (spec 2026-10-15-primeiro-uso, parte 2), e a
 * assinatura pela Stripe (backend #180, spec 2026-10-31-assinatura-pela-stripe). Sem `situacao`
 * (backend antigo) ou com valor desconhecido, a assinatura é ausente e nada bloqueia.
 */
export type PlanoId = "essencial" | "padrao" | "avancado";
export type SituacaoDaConta = "sem_plano" | "teste" | "teste_encerrado" | "ativo" | "pagamento_pendente" | "assinatura_encerrada";
export type Periodo = "mensal" | "trimestral" | "semestral" | "anual";
/** A assinatura na Stripe, o bloco `assinatura` do `/me`; `periodoAtualFim` é o dia em São Paulo. */
export type Cobranca = { status: string; plano: PlanoId; periodo: Periodo; periodoAtualFim: string | null; cancelaNoFim: boolean };
export type Assinatura = {
  situacao: SituacaoDaConta;
  plano: PlanoId | null;
  /** O último dia do teste em São Paulo (`AAAA-MM-DD`), para contar os dias. */
  testeTerminaEm: string | null;
  /** O instante em que o teste acaba, para a regra das 48 horas da Stripe. */
  fimDoTeste: string | null;
  cobranca: Cobranca | null;
};

const SITUACOES: SituacaoDaConta[] = ["sem_plano", "teste", "teste_encerrado", "ativo", "pagamento_pendente", "assinatura_encerrada"];
export const PERIODOS: Periodo[] = ["mensal", "trimestral", "semestral", "anual"];
export const MESES_DO_PERIODO: Record<Periodo, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const NOMES: Record<PlanoId, string> = { essencial: "Essencial", padrao: "Padrão", avancado: "Avançado" };

const HOJE_EM_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** O dia em São Paulo de uma data (`AAAA-MM-DD`, que passa como está) ou de uma data e hora ISO; null fora disso. */
export function diaEmSaoPaulo(texto: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(texto)) return null;
  const instante = new Date(texto);
  return Number.isNaN(instante.getTime()) ? null : HOJE_EM_SP.format(instante);
}

const ehPlano = (valor: unknown): valor is PlanoId => typeof valor === "string" && Object.hasOwn(NOMES, valor);

function adaptarCobranca(bruto: unknown): Cobranca | null {
  if (!bruto || typeof bruto !== "object") return null;
  const { status, plano, periodo, periodo_atual_fim, cancelar_no_fim_do_periodo } = bruto as Record<string, unknown>;
  if (typeof status !== "string" || !ehPlano(plano) || !PERIODOS.includes(periodo as Periodo)) return null;
  const fim = typeof periodo_atual_fim === "string" ? diaEmSaoPaulo(periodo_atual_fim) : null;
  return { status, plano, periodo: periodo as Periodo, periodoAtualFim: fim, cancelaNoFim: cancelar_no_fim_do_periodo === true };
}

export function adaptarAssinatura(bruto: {
  situacao?: unknown;
  plano?: unknown;
  teste_termina_em?: unknown;
  assinatura?: unknown;
}): Assinatura | null {
  if (!SITUACOES.includes(bruto.situacao as SituacaoDaConta)) return null;
  const fim = typeof bruto.teste_termina_em === "string" ? bruto.teste_termina_em : null;
  const dia = fim === null ? null : diaEmSaoPaulo(fim);
  return {
    situacao: bruto.situacao as SituacaoDaConta,
    plano: ehPlano(bruto.plano) ? bruto.plano : null,
    testeTerminaEm: dia,
    // o formato antigo, só o dia, acaba à meia-noite de São Paulo (sem horário de verão desde 2019)
    fimDoTeste: dia === null ? null : dia === fim ? `${dia}T00:00:00-03:00` : fim,
    cobranca: adaptarCobranca(bruto.assinatura),
  };
}

/** Sem acesso a nova conciliação: o teste acabou ou a assinatura foi encerrada. O pagamento pendente segue aberto. */
export function bloqueiaConciliacao(situacao: SituacaoDaConta): boolean {
  return situacao === "teste_encerrado" || situacao === "assinatura_encerrada";
}

// a Stripe só aceita o fim do teste no checkout com 48 horas de antecedência (backend #180)
const ANTECEDENCIA_DO_TESTE_MS = 48 * 60 * 60 * 1000;

/** Assinar agora cobra na hora: fora do teste, ou com menos de 48 horas dele (o resto do teste se perde). */
export function cobrancaImediata(assinatura: Assinatura, agora: Date): boolean {
  if (assinatura.situacao !== "teste" || assinatura.fimDoTeste === null) return true;
  return new Date(assinatura.fimDoTeste).getTime() - agora.getTime() < ANTECEDENCIA_DO_TESTE_MS;
}

/** `2026-12-14` → `14/12`. */
export function formatarDiaCurto(dia: string): string {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
}

/** Dias de calendário até o fim do teste, contados em São Paulo; nunca negativo. */
export function diasRestantes(testeTerminaEm: string, agora: Date): number {
  const [a, m, d] = testeTerminaEm.split("-").map(Number);
  const [ha, hm, hd] = HOJE_EM_SP.format(agora).split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86_400_000));
}

export function fraseDoTeste(dias: number): string {
  if (dias === 0) return "Teste grátis · último dia";
  return dias === 1 ? "Teste grátis · falta 1 dia" : `Teste grátis · faltam ${dias} dias`;
}

/** A mesma, curta, para caber ao lado do "?" e de Avisos na barra do topo do celular. */
export function fraseCurtaDoTeste(dias: number): string {
  if (dias === 0) return "Teste · último dia";
  return dias === 1 ? "Teste · 1 dia" : `Teste · ${dias} dias`;
}

/** Os três planos do teste, com preço e faixa de lib/planos (a tabela que vale ainda está aberta). */
export function planosDoTeste(): (Plano & { id: PlanoId })[] {
  return (Object.keys(NOMES) as PlanoId[]).map((id) => {
    const plano = PLANOS.find((p) => p.nome === NOMES[id]);
    if (!plano) throw new Error(`Plano "${NOMES[id]}" não está em lib/planos.ts`);
    return { ...plano, id };
  });
}

export const NOME_DO_PLANO = NOMES;

/** Um preço do catálogo da Stripe, pronto para o cartão do plano. `desconto` é a % contra o mensal, null sem ganho. */
export type PrecoDoPlano = {
  plano: PlanoId;
  periodo: Periodo;
  centavos: number;
  valor: string;
  /** O equivalente por mês; null no mensal. */
  porMes: string | null;
  desconto: number | null;
};

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const emReais = (centavos: number) => REAIS.format(centavos / 100).replace(/ /g, " ");

/** A lista de `GET /assinatura/precos` (backend #180); null sem nenhum preço válido. */
export function adaptarPrecos(bruto: unknown): PrecoDoPlano[] | null {
  if (!Array.isArray(bruto)) return null;
  const validos = bruto.filter(
    (item): item is { plano: PlanoId; periodo: Periodo; valor_centavos: number } =>
      !!item &&
      ehPlano(item.plano) &&
      PERIODOS.includes(item.periodo) &&
      Number.isInteger(item.valor_centavos) &&
      item.valor_centavos > 0,
  );
  if (validos.length === 0) return null;
  return validos.map(({ plano, periodo, valor_centavos: centavos }) => {
    const meses = MESES_DO_PERIODO[periodo];
    const mensal = validos.find((item) => item.plano === plano && item.periodo === "mensal")?.valor_centavos;
    const desconto = mensal && meses > 1 ? Math.round((1 - centavos / (mensal * meses)) * 100) : 0;
    return {
      plano,
      periodo,
      centavos,
      valor: emReais(centavos),
      porMes: meses > 1 ? emReais(Math.round(centavos / meses)) : null,
      desconto: desconto > 0 ? desconto : null,
    };
  });
}

/**
 * Só redireciona para o checkout da Stripe; fora de produção, também para a volta que o backend-fake
 * devolve (`/assinatura?checkout=...`). Uma resposta estranha nunca manda a pessoa para outro site.
 */
export function urlDeCheckoutValida(url: string, producao: boolean): boolean {
  if (url.startsWith("https://checkout.stripe.com/")) return true;
  return !producao && url.startsWith("/assinatura?checkout=");
}

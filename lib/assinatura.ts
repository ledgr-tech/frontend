import { PLANOS, type Plano } from "./planos";

/**
 * O plano e o teste de 14 dias da conta, do `GET /me` (spec 2026-10-15-primeiro-uso, parte 2).
 * Sem `situacao` (backend antigo) ou com valor desconhecido, a assinatura é ausente e nada bloqueia.
 */
export type PlanoId = "essencial" | "padrao" | "avancado";
export type SituacaoDaConta = "sem_plano" | "teste" | "teste_encerrado" | "ativo";
export type Assinatura = { situacao: SituacaoDaConta; plano: PlanoId | null; testeTerminaEm: string | null };

const SITUACOES: SituacaoDaConta[] = ["sem_plano", "teste", "teste_encerrado", "ativo"];
const NOMES: Record<PlanoId, string> = { essencial: "Essencial", padrao: "Padrão", avancado: "Avançado" };

export function adaptarAssinatura(bruto: { situacao?: unknown; plano?: unknown; teste_termina_em?: unknown }): Assinatura | null {
  if (!SITUACOES.includes(bruto.situacao as SituacaoDaConta)) return null;
  const plano = typeof bruto.plano === "string" && bruto.plano in NOMES ? (bruto.plano as PlanoId) : null;
  const data = typeof bruto.teste_termina_em === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto.teste_termina_em) ? bruto.teste_termina_em : null;
  return { situacao: bruto.situacao as SituacaoDaConta, plano, testeTerminaEm: data };
}

const HOJE_EM_SP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

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

/** Os três planos do teste, com preço e faixa de lib/planos (a tabela que vale ainda está aberta). */
export function planosDoTeste(): (Plano & { id: PlanoId })[] {
  return (Object.keys(NOMES) as PlanoId[]).map((id) => {
    const plano = PLANOS.find((p) => p.nome === NOMES[id]);
    if (!plano) throw new Error(`Plano "${NOMES[id]}" não está em lib/planos.ts`);
    return { ...plano, id };
  });
}

export const NOME_DO_PLANO = NOMES;

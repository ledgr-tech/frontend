export type Agrupamento = "mes" | "ano" | "nenhum";

const CHAVE = "ledgr_extratos_agrupamento";
const VALIDOS: readonly Agrupamento[] = ["mes", "ano", "nenhum"];

/**
 * Como a galeria de extratos agrupa as folhas, lembrado entre as visitas, como a densidade das
 * tabelas (`../densidade.ts`). Fica no navegador de quem escolheu. Sem escolha, ou com um valor
 * que não é um agrupamento, agrupa por mês.
 */
export function agrupamentoSalvo(): Agrupamento {
  if (typeof window === "undefined") return "mes";
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    return VALIDOS.find((agrupamento) => agrupamento === salvo) ?? "mes";
  } catch {
    return "mes";
  }
}

export function salvarAgrupamento(agrupamento: Agrupamento): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, agrupamento);
  } catch {
    // sem persistência, mas a visita atual ainda respeita a escolha
  }
}

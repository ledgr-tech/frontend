export type Densidade = "padrao" | "compacta";

const CHAVE = "ledgr_densidade";

/**
 * Densidade das tabelas. O design resolve isso com `zoom` em quatro níveis, o que
 * escala a página inteira — incluindo o menu sticky e os painéis posicionados, que
 * passariam a calcular posição sobre um layout escalado. Aqui o controle é só das
 * linhas de tabela, que é onde a densidade paga numa ferramenta de conciliação.
 */
export function densidadeAtual(): Densidade {
  if (typeof window === "undefined") return "padrao";
  try {
    return window.localStorage.getItem(CHAVE) === "compacta" ? "compacta" : "padrao";
  } catch {
    return "padrao";
  }
}

export function aplicarDensidade(densidade: Densidade): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, densidade);
  } catch {
    // sem persistência, mas a sessão atual ainda respeita a escolha
  }
  document.documentElement.dataset.densidade = densidade;
}

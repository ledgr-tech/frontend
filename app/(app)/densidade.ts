export type Densidade = "padrao" | "compacta";

const CHAVE = "ledgr_densidade";

/**
 * Densidade das tabelas. O design resolve isso com `zoom` em quatro níveis, o que
 * escala a página inteira — incluindo o menu sticky e os painéis posicionados, que
 * passariam a calcular posição sobre um layout escalado. Aqui o controle é só das
 * linhas de tabela, que é onde a densidade paga numa ferramenta de conciliação.
 *
 * A compacta é o padrão: lê melhor uma comparação de centenas de linhas. Só quem
 * escolheu a padrão fica com ela; o CSS segue a mesma regra (`globals.css`, bloco
 * "Densidade da tabela").
 */
export function densidadeAtual(): Densidade {
  if (typeof window === "undefined") return "compacta";
  try {
    return window.localStorage.getItem(CHAVE) === "padrao" ? "padrao" : "compacta";
  } catch {
    return "compacta";
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

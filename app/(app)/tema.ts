export type Tema = "claro" | "escuro";

const CHAVE = "ledgr_tema";

/** O que o sistema operacional pede. É o padrão enquanto ninguém escolheu nada. */
export function temaDoSistema(): Tema {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "claro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

/** A escolha salva, ou a do sistema quando não há escolha. */
export function temaAtual(): Tema {
  if (typeof window === "undefined") return "claro";
  let salvo: string | null = null;
  try {
    salvo = window.localStorage.getItem(CHAVE);
  } catch {
    // localStorage bloqueado (janela anônima, cookies negados): segue o sistema
  }
  return salvo === "claro" || salvo === "escuro" ? salvo : temaDoSistema();
}

/**
 * Fixa um tema. Escrever o atributo em <html> é o que liga o bloco escuro do CSS;
 * o mesmo atributo é escrito antes da primeira pintura pelo script em
 * `app/layout.tsx`, para o app não abrir claro e piscar.
 */
export function aplicarTema(tema: Tema): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, tema);
  } catch {
    // sem persistência, mas a sessão atual ainda respeita a escolha
  }
  document.documentElement.dataset.tema = tema;
}

const CHAVE = "ledgr_menu";

/**
 * Se o menu lateral está recolhido. Lê o atributo de <html>, não o localStorage:
 * o atributo é o que o CSS está mostrando agora (o script em `app/layout.tsx` o
 * escreve antes da primeira pintura), e continua valendo quando o localStorage
 * está bloqueado.
 */
export function menuRecolhido(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.menu === "recolhido";
}

/** Recolhe ou abre o menu e devolve o novo estado (true = recolhido). */
export function alternarMenu(): boolean {
  const recolhido = !menuRecolhido();
  const valor = recolhido ? "recolhido" : "aberto";
  try {
    window.localStorage.setItem(CHAVE, valor);
  } catch {
    // sem persistência, mas a sessão atual ainda respeita a escolha
  }
  document.documentElement.dataset.menu = valor;
  return recolhido;
}

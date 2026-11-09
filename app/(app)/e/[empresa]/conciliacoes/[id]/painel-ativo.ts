import { useSyncExternalStore } from "react";

/**
 * A largura mínima da comparação com painel. Abaixo disso, volta o balão no hover.
 * O CSS usa o mesmo limite para o recuo da tela (`.comparacao-grade` em globals.css).
 */
export const LARGURA_DO_PAINEL = 1100;
const CONSULTA = `(min-width: ${LARGURA_DO_PAINEL}px)`;

function inscrever(avisar: () => void): () => void {
  const consulta = window.matchMedia?.(CONSULTA);
  // um matchMedia mínimo (os testes do balão) não escuta mudanças: tudo opcional
  consulta?.addEventListener?.("change", avisar);
  return () => consulta?.removeEventListener?.("change", avisar);
}

/** Se a tela tem largura para o painel. No servidor e no primeiro desenho, não: a comparação carrega no cliente. */
export function usePainelAtivo(): boolean {
  return useSyncExternalStore(
    inscrever,
    () => window.matchMedia?.(CONSULTA).matches ?? false,
    () => false,
  );
}

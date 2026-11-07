import { useSyncExternalStore } from "react";

/**
 * A partir de que largura o painel da direita cabe (issue #338): a tabela mantém os 1240px de sempre e o
 * painel, de 348px, ocupa a margem que sobra. Abaixo disso a comparação segue como era, com o balão no hover.
 * O CSS usa o mesmo número (`.comparacao-grade` em globals.css).
 */
export const LARGURA_DO_PAINEL = 1700;
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

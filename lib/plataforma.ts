import { useSyncExternalStore } from "react";

/** Mac, iPhone e iPad usam ⌘ nos atalhos; o resto, Ctrl. */
export function ehMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

// a plataforma não muda com a página aberta: não há o que assinar
function semAssinatura() {
  return () => {};
}

/**
 * A tecla dos atalhos neste computador. No servidor e na hidratação é "Ctrl", a
 * do Windows, que é o caso da maioria; num Mac troca para "⌘" logo depois, sem
 * erro de hidratação.
 */
export function useTeclaDeAtalho(): "⌘" | "Ctrl" {
  return useSyncExternalStore(
    semAssinatura,
    () => (ehMac() ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

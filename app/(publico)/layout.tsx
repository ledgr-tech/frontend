import type { ReactNode } from "react";

/**
 * O relatório que o contador manda ao cliente, sem login. O `app-shell` traz os tokens da folha
 * (`--folha-banco`, `--texto-apagado`), a tipografia dos títulos e o tema escuro do app, como na
 * Central de ajuda; sem ele, o quadro de números ficava sem papel e os textos sem o cinza.
 */
export default function PublicoLayout({ children }: { children: ReactNode }) {
  return <div className="app-shell rel-publico">{children}</div>;
}

import type { ReactNode } from "react";

// mensagem de erro de formulário: fica logo abaixo do campo, ligada a ele por aria-describedby
// (estilo .campo-erro em globals.css: terracota, ícone e entrada curta de cima para baixo)
export function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="campo-erro">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.4" />
        <path d="M8 4.8v3.6M8 11v.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

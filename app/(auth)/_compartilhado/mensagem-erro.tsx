import type { ReactNode } from "react";

// mensagem de erro de formulário: fica logo abaixo do campo, ligada a ele por aria-describedby
// (estilo .campo-erro em globals.css: nota na margem, traço terracota e Newsreader itálico)
export function MensagemErro({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="campo-erro">
      {children}
    </p>
  );
}

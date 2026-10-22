import type { ReactNode } from "react";

/**
 * A comparação e, por cima dela, o detalhe de uma linha num painel (`@painel/(.)[linha]`): aberto
 * pela tabela, o endereço vira o da linha e a comparação continua montada atrás. Link colado ou
 * recarregado não é interceptado e abre a página inteira de `[linha]`.
 */
export default function ConciliacaoLayout({ children, painel }: { children: ReactNode; painel: ReactNode }) {
  return (
    <>
      {children}
      {painel}
    </>
  );
}

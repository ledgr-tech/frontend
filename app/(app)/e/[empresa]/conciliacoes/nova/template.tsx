import type { ReactNode } from "react";
import { TransicaoDeTela } from "../../../../../transicao-de-tela";

// o template do app só remonta quando muda a seção (conciliacoes); este remonta entre /nova, /nova/ia e a
// conferência, e o "Voltar para Nova conciliação" ganha a mesma transição das outras telas
export default function Template({ children }: { children: ReactNode }) {
  return <TransicaoDeTela>{children}</TransicaoDeTela>;
}

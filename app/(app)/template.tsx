import type { ReactNode } from "react";
import { TransicaoDeTela } from "../transicao-de-tela";

// fica abaixo do layout do app: o menu continua parado e só o conteúdo de cada tela faz a transição
export default function Template({ children }: { children: ReactNode }) {
  return <TransicaoDeTela>{children}</TransicaoDeTela>;
}

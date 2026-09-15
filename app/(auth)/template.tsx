import type { ReactNode } from "react";
import { TransicaoDeTela } from "../transicao-de-tela";

// login e cadastro ficam no mesmo grupo: sem este template a troca entre eles não remontaria nada
export default function Template({ children }: { children: ReactNode }) {
  return <TransicaoDeTela>{children}</TransicaoDeTela>;
}

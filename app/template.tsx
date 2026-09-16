import type { ReactNode } from "react";
import { TransicaoDeTela } from "./transicao-de-tela";

// o template remonta quando o primeiro nível da rota muda (landing, acesso, app): a transição anima essa troca
export default function Template({ children }: { children: ReactNode }) {
  return <TransicaoDeTela>{children}</TransicaoDeTela>;
}

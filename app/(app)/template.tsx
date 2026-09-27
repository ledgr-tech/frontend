import type { ReactNode } from "react";
import { MotionRoot } from "../reveal";
import { TransicaoDeTela } from "../transicao-de-tela";

// fica abaixo do layout do app: o menu continua parado e só o conteúdo de cada tela faz a transição.
// O MotionRoot é daqui para toda tela poder usar o Reveal e os efeitos de hover sem repetir o invólucro.
export default function Template({ children }: { children: ReactNode }) {
  return (
    <TransicaoDeTela>
      <MotionRoot>{children}</MotionRoot>
    </TransicaoDeTela>
  );
}

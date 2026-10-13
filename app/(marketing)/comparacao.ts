import type { StatusLinha } from "@/lib/mock-data";

/** Uma linha de agosto da landing, de um lado ou dos dois: o jogo do Cap. II e a janela de "Por dentro". */
export type LinhaExtrato = {
  data: string;
  desc: string;
  valorBanco: string | null;
  valorSistema: string | null;
  /** O código do motor; o nome que aparece é o do app (`seloDoStatus`). */
  status: StatusLinha;
  explicacao: string | null;
};

"use client";

import { useId, useRef, useState } from "react";
import type { StatusLinha } from "@/lib/mock-data";
import { TabelaFolhas } from "./tabela-folhas";

export type LinhaExtrato = {
  data: string;
  desc: string;
  valorBanco: string | null;
  valorSistema: string | null;
  /** O código do motor; o nome que aparece é o do app (`seloDoStatus`). */
  status: StatusLinha;
  explicacao: string | null;
};

// quanto tempo depois de um cartão fechar o próximo ainda conta como "em sequência"
const JANELA_SEQUENCIA_MS = 150;

/**
 * A demonstração de "O problema": as mesmas duas telas da conferência à mão, já conferidas, na
 * tabela da Comparação direta do app (TabelaFolhas). Passar o mouse, focar ou tocar numa linha que
 * pede revisão abre o cartão do hover do app, com o motivo. No celular a tabela vira cartões, como
 * no app (.tabela-cartoes).
 */
export function ExtratoComparacao({ banco, sistema }: { banco: LinhaExtrato[]; sistema: LinhaExtrato[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  // como tooltip em sequência: o primeiro cartão sobe, e quem desce direto para a linha seguinte vê
  // o próximo na hora, sem esperar a subida de cada um (globals.css, data-na-hora)
  const [naHora, setNaHora] = useState(false);
  // quem já abriu uma linha entendeu o hover: a dica embaixo da tabela para de animar (globals.css)
  const [explorada, setExplorada] = useState(false);
  const fechouEm = useRef(-Infinity);
  const idCartao = useId();

  const abrir = (desc: string) => {
    // o toque e o foco chegam depois do hover na mesma linha: o cartão já está aberto, e mexer no
    // data-na-hora agora faria a subida recomeçar
    if (desc === aberta) return;
    setNaHora(performance.now() - fechouEm.current < JANELA_SEQUENCIA_MS);
    setExplorada(true);
    setAberta(desc);
  };
  // o ponteiro que desce de uma linha para a outra fecha uma e abre a seguinte no mesmo instante
  const fechar = (desc: string) => {
    fechouEm.current = performance.now();
    setAberta((atual) => (atual === desc ? null : atual));
  };

  return (
    <div className="demonstracao-folhas tabela-cartoes" data-explorado={explorada || undefined}>
      <TabelaFolhas banco={banco} sistema={sistema} interacao={{ aberta, idCartao, naHora, abrir, fechar }} />
    </div>
  );
}

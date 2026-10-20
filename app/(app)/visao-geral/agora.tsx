"use client";

import Link from "next/link";
import { TudoEmDia } from "../coluna/tudo-em-dia";
import { usePreferencias } from "../conta";
import { BotaoDoPasso } from "./roteiro-faixa";
import type { PassoDoRoteiro } from "./roteiro";

/**
 * O "Agora" da Visão geral: o próximo passo dos primeiros passos (enquanto a faixa existe), senão as
 * pendências do mês em foco, senão "Tudo em dia".
 */
export function AgoraDaVisaoGeral({
  proximo,
  pendente,
}: {
  proximo: PassoDoRoteiro | null;
  pendente: { mes: string; quantidade: number; href: string } | null;
}) {
  // "Já sei usar" some com a faixa, e com o passo dela aqui
  const { roteiroDispensado } = usePreferencias();
  if (proximo && !roteiroDispensado) {
    return (
      <div className="conc-continuar">
        <span className="conc-continuar-titulo">{proximo.titulo}</span>
        <span className="conc-continuar-texto">{proximo.texto}</span>
        <BotaoDoPasso passo={proximo} />
      </div>
    );
  }
  if (pendente) {
    return (
      <div className="conc-continuar">
        <Link href={pendente.href} className="btn btn-primary">
          {`${pendente.quantidade} ${pendente.quantidade === 1 ? "pendência" : "pendências"} em ${pendente.mes}`}
        </Link>
      </div>
    );
  }
  return <TudoEmDia />;
}

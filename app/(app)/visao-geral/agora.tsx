"use client";

import Link from "next/link";
import { ColunaDaTela } from "../coluna/coluna";
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
  // a mesma condição da faixa: só mostra o passo depois de saber se foi dispensado
  const { carregado, roteiroDispensado } = usePreferencias();
  const passo = proximo && carregado && !roteiroDispensado ? proximo : null;
  // o servidor não sabe do "Já sei usar": o ponto do botão "Agora" sai daqui
  return (
    <ColunaDaTela pendente={passo !== null || pendente !== null}>
      {passo ? (
        <div className="conc-continuar">
          <span className="conc-continuar-titulo">{passo.titulo}</span>
          <span className="conc-continuar-texto">{passo.texto}</span>
          <BotaoDoPasso passo={passo} />
        </div>
      ) : proximo && !carregado ? null : pendente ? (
        <div className="conc-continuar">
          <Link href={pendente.href} className="btn btn-primary">
            {`${pendente.quantidade} ${pendente.quantidade === 1 ? "pendência" : "pendências"} em ${pendente.mes}`}
          </Link>
        </div>
      ) : (
        <TudoEmDia />
      )}
    </ColunaDaTela>
  );
}

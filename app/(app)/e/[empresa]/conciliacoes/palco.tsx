"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { IconeOrigem } from "../icone-origem";
import { DETALHE, RECADO, type Etapa, type Origem } from "./envio";

// as etapas do envio na ordem em que acontecem (envio.ts)
const ETAPAS: Etapa[] = ["conferindo", "enviando", "processando", "conciliando"];
// as larguras das barras de valor do banco e do sistema: parecidas, nunca iguais
const LINHAS = [
  [64, 60],
  [56, 46],
  [76, 74],
  [70, 60],
  [66, 64],
  [60, 82],
  [80, 56],
  [72, 66],
  [58, 70],
  [68, 52],
  [74, 62],
  [62, 78],
  [70, 58],
  [66, 72],
];

/**
 * No envio, o palco toma a tela: as duas folhas saem da sobreposição para os lados, as linhas de
 * cada uma entram como barras, sem dado nenhum, e os pares se ligam pelo meio com o ✓ numa onda que
 * não para até a comparação abrir. As linhas são ilustração; o progresso de verdade é a etapa no topo e o texto embaixo.
 */
export function Palco({ banco, sistema, etapa }: { banco: string; sistema: string; etapa: Etapa }) {
  const indice = ETAPAS.indexOf(etapa) + 1;
  const folha = (origem: Origem, nome: string) => (
    <div className={`nova-palco-folha nova-palco-${origem}`}>
      <div className="nova-palco-cabeca">
        <span className="rotulo">
          <IconeOrigem origem={origem} tamanho={15} />
          {origem === "banco" ? "Banco" : "Sistema de gestão"}
        </span>
        <span>{nome}</span>
      </div>
      {LINHAS.map((larguras, i) => (
        <div key={i} className="nova-palco-linha" style={{ "--i": i } as CSSProperties} aria-hidden="true">
          <span className="nova-palco-barra" style={{ width: "80%" }} />
          <span className="nova-palco-barra" style={{ width: `${larguras[origem === "banco" ? 0 : 1]}%` }} />
        </div>
      ))}
    </div>
  );
  return (
    <div className="nova-palco">
      <div className="nova-palco-topo">
        <div className="nova-etapas">
          <span className="nova-etapas-barra" aria-hidden="true">
            {ETAPAS.map((nome, i) => (
              <span key={nome} data-feita={i < indice ? "" : undefined} />
            ))}
          </span>
          <span className="nova-etapas-texto">{`Etapa ${indice} de ${ETAPAS.length}`}</span>
        </div>
      </div>
      <div className="nova-palco-mesa">
        {folha("banco", banco)}
        <div className="nova-palco-elos" aria-hidden="true">
          {LINHAS.map((_, i) => (
            <span key={i} className="nova-palco-elo" style={{ "--i": i } as CSSProperties}>
              <span className="nova-palco-marca">
                <Check />
              </span>
            </span>
          ))}
        </div>
        {folha("sistema", sistema)}
      </div>
      {/* a key refaz a entrada a cada etapa: o texto novo chega, não troca de supetão */}
      <div className="nova-palco-rodape" key={etapa} aria-live="polite">
        <p className="nova-palco-recado">{RECADO[etapa as Exclude<Etapa, "ocioso">]}</p>
        <p className="nova-palco-detalhe">{DETALHE[etapa as Exclude<Etapa, "ocioso">]}</p>
      </div>
    </div>
  );
}

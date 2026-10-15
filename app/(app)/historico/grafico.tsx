import type { CSSProperties } from "react";
import type { Execucao } from "@/lib/adaptadores";
import { formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { tituloDaCompetencia } from "../fechamentos/fechamento";
import { alturasNoGrafico, rotulosDaSerie, serieMensal } from "./execucoes";

/** "setembro", de "2026-09": o mês no meio de uma frase. */
function mesNaFrase(chave: string): string {
  return tituloDaCompetencia(chave).split(" de ")[0].toLowerCase();
}

/**
 * A taxa de match mês a mês, pelo mês do extrato, dos seis meses mais recentes. Mora no
 * histórico e aparece também na visão geral. É um fio, não blocos: a cor vai no traço, como
 * pede o estilo do app, e a linha se desenha uma vez ao abrir, como o fio das rodadas. Ela fica
 * num SVG que estica com a largura; os pontos e os números ficam em HTML por cima, para não
 * deformarem. Sem mês com lançamento, não desenha nada.
 */
export function GraficoDeMatch({
  execucoes,
}: {
  /** As que valem (`execucoesVigentes`). Cada uma traz o período do extrato do banco, que dá o mês. */
  execucoes: Execucao[];
}) {
  const serie = serieMensal(execucoes);
  const atual = serie.at(-1);
  if (!atual) return null;

  const meses = serie.length;
  const rotulos = rotulosDaSerie(serie);
  const alturas = alturasNoGrafico(serie.map((ponto) => ponto.taxa));
  const variacao = meses > 1 ? atual.taxa - serie[0].taxa : null;
  // no meio de cada fatia da largura, a mesma conta na linha e nos pontos
  const xDe = (indice: number) => ((indice + 0.5) / meses) * 100;
  const fio = serie.map((_, indice) => `${xDe(indice) * meses},${(1 - alturas[indice]) * 100}`).join(" ");

  return (
    <div className="hist-grafico-bloco">
      <div className="hist-grafico-topo">
        <div>
          <h6 className="hist-grafico-titulo">Taxa de match automático</h6>
          <div className="hist-destaque">
            {formatarPercentual(atual.taxa)} em {mesNaFrase(atual.chave)}
          </div>
        </div>
        {variacao !== null && (
          <span className="hist-nota">
            {variacao >= 0 ? "Subiu" : "Caiu"} {formatarPercentual(Math.abs(variacao)).replace("%", "")} pontos
            desde {mesNaFrase(serie[0].chave)}.
          </span>
        )}
      </div>

      <div className="grafico-fio" style={{ "--meses": meses } as CSSProperties}>
        <div className="grafico-fio-area">
          <svg className="grafico-fio-linha" viewBox={`0 0 ${meses * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
            <polyline points={fio} vectorEffect="non-scaling-stroke" />
          </svg>
          <ol className="grafico-fio-pontos" aria-label="Taxa de match por mês">
            {serie.map((ponto, indice) => {
              const lancamentos = `${formatarInteiro(ponto.conciliados)} de ${formatarInteiro(ponto.lancamentos)} lançamentos`;
              return (
                <li
                  key={ponto.chave}
                  className="grafico-fio-ponto"
                  data-atual={indice === meses - 1 || undefined}
                  title={`${tituloDaCompetencia(ponto.chave).toLowerCase()} · ${formatarPercentual(ponto.taxa)} · ${lancamentos}`}
                  style={
                    {
                      left: `${xDe(indice)}%`,
                      bottom: `${alturas[indice] * 100}%`,
                      // o ponto aparece quando o fio chega nele
                      "--atraso": `${((xDe(indice) / 100) * 0.9).toFixed(2)}s`,
                    } as CSSProperties
                  }
                >
                  <span className="grafico-fio-valor" aria-hidden="true">
                    {formatarPercentual(ponto.taxa)}
                  </span>
                  <span className="sr-only">{`${tituloDaCompetencia(ponto.chave)}: ${formatarPercentual(ponto.taxa)}, ${lancamentos}`}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="grafico-fio-meses" aria-hidden="true">
          {rotulos.map((rotulo, indice) => (
            <span key={serie[indice].chave} data-atual={indice === meses - 1 || undefined}>
              {rotulo}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

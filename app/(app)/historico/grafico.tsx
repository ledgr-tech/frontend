import type { Execucao } from "@/lib/adaptadores";
import { formatarDiaMes, formatarPercentual } from "../dashboard/resumo";
import { alturasDasBarras, paraGrafico, variacaoEmPontos } from "./execucoes";

// O gráfico mede taxa de match, que é a métrica "ok" — mesma cor que ela tem na
// dashboard. Rampa sequencial (uma série ao longo do tempo, não categorias): do
// mais claro ao mais forte, então a execução mais recente é a que pesa.
const RAMPA = [200, 200, 300, 300, 500, 700];

/**
 * Taxa de match das seis execuções mais recentes, da mais antiga para a mais
 * nova. Mora no histórico e aparece também na visão geral. Sem execução com
 * percentual, não desenha nada.
 */
export function GraficoDeMatch({ execucoes }: { execucoes: Execucao[] }) {
  const grafico = paraGrafico(execucoes);
  const maisRecente = grafico.at(-1);
  if (!maisRecente) return null;

  const alturas = alturasDasBarras(grafico.map((item) => item.acerto));
  // com menos de seis barras, usa o fim da rampa: a mais recente é sempre a mais forte
  const tons = RAMPA.slice(RAMPA.length - grafico.length);
  const variacao = variacaoEmPontos(grafico);

  return (
    <div className="hist-grafico-bloco">
      <div className="hist-grafico-topo">
        <div>
          <h6 style={{ margin: "0 0 6px", color: "var(--color-accent-700)" }}>
            Taxa de match automático
          </h6>
          <div className="hist-destaque" style={{ color: "var(--color-ok-700)" }}>
            {formatarPercentual(maisRecente.acerto)} em {formatarDiaMes(maisRecente.executadaEm)}
          </div>
        </div>
        {variacao !== null && (
          <span className="hist-nota">
            {variacao >= 0 ? "Subiu" : "Caiu"} {formatarPercentual(Math.abs(variacao)).replace("%", "")}{" "}
            pontos desde {formatarDiaMes(grafico[0].executadaEm)}.
          </span>
        )}
      </div>
      <div className="hist-barras">
        {grafico.map((item, i) => (
          <div key={item.id} className="hist-barra-coluna">
            <span className="hist-barra-taxa">{formatarPercentual(item.acerto)}</span>
            <div
              className="hist-barra"
              style={{
                height: alturas[i],
                borderColor: `var(--color-ok-${tons[i]})`,
                background: `color-mix(in srgb, var(--color-ok-${tons[i]}) ${14 + (RAMPA.length - grafico.length + i) * 5}%, transparent)`,
              }}
            />
            <span className="hist-barra-mes">{formatarDiaMes(item.executadaEm)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

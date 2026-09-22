"use client";

import Image from "next/image";
import { EMPRESA_MOCK, HISTORICO_MESES, formatarMoeda } from "@/lib/mock-data";
import { formatarInteiro, formatarMoedaCurta, formatarPercentual } from "../dashboard/resumo";

// A lista vem da mais recente para a mais antiga (como a tabela); o gráfico lê
// na ordem inversa, para o tempo correr da esquerda para a direita.
const CRONOLOGICO = [...HISTORICO_MESES].reverse();

// Tom de ouro por posição, do mais claro ao mais forte: o mês atual é o que pesa.
const RAMPA = [200, 200, 300, 300, 500, 700];

/** Mesma escala do design: 28px de base e 11px por ponto percentual acima de 90. */
function alturaDaBarra(taxa: number): number {
  return Math.round(28 + (taxa - 90) * 11);
}

export default function HistoricoPage() {
  const atual = HISTORICO_MESES[0];
  const maisAntigo = CRONOLOGICO[0];
  const ganho = atual.taxaMatch - maisAntigo.taxaMatch;
  const mesAtual = atual.mes.split(" ")[0].toLowerCase();
  const mesAntigo = maisAntigo.mes.split(" ")[0].toLowerCase();

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>
            Histórico de conciliações
          </h1>
          <span
            style={{
              fontSize: 14,
              fontVariantNumeric: "tabular-nums",
              color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
            }}
          >
            {HISTORICO_MESES.length} meses · {EMPRESA_MOCK}
          </span>
        </div>
      </div>

      <div className="hist-corpo">
        <div className="hist-grafico-bloco">
          <div className="hist-grafico-topo">
            <div>
              <h6 style={{ margin: "0 0 6px", color: "var(--color-accent-700)" }}>
                Taxa de match automático
              </h6>
              <div className="hist-destaque">
                {formatarPercentual(atual.taxaMatch)} em {mesAtual}
              </div>
            </div>
            <span className="hist-nota">
              Subiu {formatarPercentual(ganho).replace("%", "")} pontos desde {mesAntigo}, quando a
              tolerância foi ajustada.
            </span>
          </div>
          <div className="hist-barras">
            {CRONOLOGICO.map((mes, i) => (
              <div key={mes.mes} className="hist-barra-coluna">
                <span className="hist-barra-taxa">{formatarPercentual(mes.taxaMatch)}</span>
                <div
                  className="hist-barra"
                  style={{
                    height: alturaDaBarra(mes.taxaMatch),
                    borderColor: `var(--color-accent-${RAMPA[i]})`,
                    background: `color-mix(in srgb, var(--color-accent-${RAMPA[i]}) ${14 + i * 5}%, transparent)`,
                  }}
                />
                <span className="hist-barra-mes">{mes.mes.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>Mês a mês</h3>
          <div className="dash-tabela-rolagem">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Competência</th>
                  <th style={{ width: 130, textAlign: "right" }}>Lançamentos</th>
                  <th style={{ width: 120, textAlign: "right" }}>Match</th>
                  <th style={{ width: 150, textAlign: "right" }}>Ajuste líquido</th>
                  <th style={{ textAlign: "right" }}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {HISTORICO_MESES.map((mes) => (
                  <tr key={mes.mes}>
                    <td>{mes.mes}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatarInteiro(mes.lancamentos)}
                    </td>
                    <td className="dash-valor-celula">{formatarPercentual(mes.taxaMatch)}</td>
                    <td className="dash-valor-celula">{formatarMoedaCurta(mes.ajusteLiquido)}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={mes.fechadoComRessalva ? "selo selo-medio" : "selo"}>
                        {mes.fechadoComRessalva ? "Fechado com ressalva" : "Fechado"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="hist-economia">
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>
              Economia acumulada
            </h6>
            <h2 style={{ margin: "0 0 10px", fontSize: 32, fontWeight: 400, lineHeight: 1.12, textWrap: "balance" }}>
              Três dias de conferência manual em seis meses.
            </h2>
            <p className="hist-economia-texto">
              Considerando o tempo médio de conferência linha a linha antes do Ledgr contra o tempo
              gasto revisando só as divergências apontadas. No total foram{" "}
              {formatarMoeda(HISTORICO_MESES.reduce((soma, mes) => soma + mes.ajusteLiquido, 0))} em
              ajustes.
            </p>
          </div>
          <Image
            src="/mascotes/mascote-dinheiro.png"
            alt="Mascote Ledgr segurando dinheiro"
            width={900}
            height={889}
            sizes="150px"
            style={{ flex: "none", width: 150, height: "auto" }}
          />
        </div>
      </div>
    </div>
  );
}

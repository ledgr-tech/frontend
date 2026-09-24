import Link from "next/link";
import { redirect } from "next/navigation";
import type { Execucao } from "@/lib/adaptadores";
import { EMPRESA_MOCK } from "@/lib/mock-data";
import { listarExecucoes } from "../conciliacoes/acoes";
import {
  formatarDataHora,
  formatarDiaMes,
  formatarInteiro,
  formatarPercentual,
} from "../dashboard/resumo";
import { alturasDasBarras, paraGrafico, variacaoEmPontos } from "./execucoes";

/**
 * O histórico lê `GET /execucoes` no servidor: uma linha por rodada de
 * conciliação, porque o backend conta por execução e não sabe a competência do
 * extrato. Por isso a tabela não é mais "mês a mês" como no design, e saíram o
 * ajuste em reais, o "fechado com ressalva" e a economia acumulada — nada disso
 * tem fonte ainda.
 */

// O gráfico mede taxa de match, que é a métrica "ok" — mesma cor que ela tem na
// dashboard. Rampa sequencial (uma série ao longo do tempo, não categorias): do
// mais claro ao mais forte, então a execução mais recente é a que pesa.
const RAMPA = [200, 200, 300, 300, 500, 700];

const FALHA_AO_CARREGAR =
  "Não foi possível carregar o histórico. Recarregue a página e tente de novo.";

const cinza = (opacidade: number) =>
  `color-mix(in srgb, var(--color-text) ${opacidade}%, transparent)`;

export default async function HistoricoPage() {
  const resposta = await listarExecucoes();
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>
            Histórico de conciliações
          </h1>
          {resposta.ok && (
            <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: cinza(55) }}>
              {formatarInteiro(resposta.dados.total)}{" "}
              {resposta.dados.total === 1 ? "execução" : "execuções"} · {EMPRESA_MOCK}
            </span>
          )}
        </div>
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : resposta.dados.execucoes.length === 0 ? (
        <SemExecucoes />
      ) : (
        <Historico execucoes={resposta.dados.execucoes} total={resposta.dados.total} />
      )}
    </div>
  );
}

function SemExecucoes() {
  return (
    <div
      style={{
        padding: "76px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 18,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Nenhuma conciliação ainda.</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, maxWidth: "48ch", color: cinza(78) }}>
        O histórico começa na primeira vez que você concilia o extrato do banco com o do sistema
        de gestão.
      </p>
      <Link href="/conciliacoes/nova" className="btn btn-primary">
        Nova conciliação
      </Link>
    </div>
  );
}

function Historico({ execucoes, total }: { execucoes: Execucao[]; total: number }) {
  const grafico = paraGrafico(execucoes);
  const alturas = alturasDasBarras(grafico.map((item) => item.acerto));
  // com menos de seis barras, usa o fim da rampa: a mais recente é sempre a mais forte
  const tons = RAMPA.slice(RAMPA.length - grafico.length);
  const maisRecente = grafico.at(-1);
  const variacao = variacaoEmPontos(grafico);

  return (
    <div className="hist-corpo">
      {maisRecente && (
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
      )}

      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>Execução a execução</h3>
        <div className="dash-tabela-rolagem">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Executada em</th>
                <th>Arquivos</th>
                <th style={{ width: 120, textAlign: "right" }}>Lançamentos</th>
                <th style={{ width: 100, textAlign: "right" }}>Match</th>
                <th style={{ width: 130, textAlign: "right" }}>Situação</th>
                <th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {execucoes.map((execucao) => (
                <tr key={execucao.id}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatarDataHora(execucao.executadaEm)}
                  </td>
                  <td style={{ overflowWrap: "anywhere" }}>
                    {execucao.arquivoBanco} × {execucao.arquivoSistema}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {formatarInteiro(execucao.lancamentos)}
                  </td>
                  <td className="dash-valor-celula">
                    {execucao.acerto === null ? "—" : formatarPercentual(execucao.acerto)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {/* o mesmo par de extratos foi conciliado de novo depois: o
                        resultado que abre é o da rodada mais nova */}
                    <span className={execucao.atual ? "selo selo-ok" : "selo"}>
                      {execucao.atual ? "Atual" : "Substituída"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link href={`/conciliacoes/${execucao.extratoBancoId}`} className="btn btn-secondary">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > execucoes.length && (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: cinza(62) }}>
            Mostrando as {execucoes.length} mais recentes de {formatarInteiro(total)}.
          </p>
        )}
      </div>
    </div>
  );
}

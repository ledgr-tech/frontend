import Link from "next/link";
import { redirect } from "next/navigation";
import type { Execucao } from "@/lib/adaptadores";
import { EMPRESA_MOCK } from "@/lib/mock-data";
import { listarExecucoes } from "../conciliacoes/acoes";
import { formatarDataHora, formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { GraficoDeMatch } from "./grafico";
import { NOTA_VER_ATUAL, VerExecucao } from "./ver-execucao";

/**
 * O histórico lê `GET /execucoes` no servidor: uma linha por rodada de
 * conciliação, porque o backend conta por execução e não sabe a competência do
 * extrato. Por isso a tabela não é mais "mês a mês" como no design, e saíram o
 * ajuste em reais, o "fechado com ressalva" e a economia acumulada — nada disso
 * tem fonte ainda.
 */

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
  return (
    <div className="hist-corpo">
      <GraficoDeMatch execucoes={execucoes} />

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
                    <VerExecucao execucao={execucao} />
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
        {execucoes.some((execucao) => !execucao.atual) && (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: cinza(62) }}>{NOTA_VER_ATUAL}</p>
        )}
      </div>
    </div>
  );
}

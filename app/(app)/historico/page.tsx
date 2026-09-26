import Link from "next/link";
import { redirect } from "next/navigation";
import type { Execucao } from "@/lib/adaptadores";
import { EMPRESA_MOCK } from "@/lib/mock-data";
import { listarExecucoes } from "../conciliacoes/acoes";
import { formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { segmentos } from "./execucoes";
import { GraficoDeMatch } from "./grafico";
import { ExportarHistorico, LinhaDoTempo } from "./linha-do-tempo";
import { NOTA_VER_ATUAL } from "./ver-execucao";

/**
 * O histórico lê `GET /execucoes` no servidor, uma página por vez: uma entrada
 * por rodada de conciliação, agrupadas pelo mês em que rodaram. O backend conta
 * por execução e não sabe a competência do extrato, então a tabela "mês a mês"
 * do design virou linha do tempo, e saíram o ajuste em reais, o "fechado com
 * ressalva" e a economia acumulada — nada disso tem fonte ainda.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar o histórico. Recarregue a página e tente de novo.";

/** "?pagina=2" → 2; qualquer outra coisa → a primeira. */
function lerPagina(valor: string | string[] | undefined): number {
  const numero = Number.parseInt(String(valor ?? ""), 10);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : 0;
}

export default async function HistoricoPage({ searchParams }: PageProps<"/historico">) {
  const pagina = lerPagina((await searchParams).pagina);
  const resposta = await listarExecucoes(pagina);
  if (!resposta.ok && resposta.status === 401) redirect("/login");

  return (
    <div>
      <div className="dash-cabecalho">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Histórico de conciliações</h1>
          {resposta.ok && (
            <span className="vg-subtitulo">
              {`${formatarInteiro(resposta.dados.total)} ${resposta.dados.total === 1 ? "execução" : "execuções"} · ${EMPRESA_MOCK}`}
            </span>
          )}
        </div>
        {resposta.ok && resposta.dados.execucoes.length > 0 && (
          <ExportarHistorico execucoes={resposta.dados.execucoes} />
        )}
      </div>

      {!resposta.ok ? (
        <p role="alert" style={{ padding: "48px 0" }}>
          {FALHA_AO_CARREGAR}
        </p>
      ) : resposta.dados.execucoes.length === 0 ? (
        <SemExecucoes pagina={pagina} />
      ) : (
        <Historico
          execucoes={resposta.dados.execucoes}
          total={resposta.dados.total}
          pagina={pagina}
          porPagina={resposta.dados.porPagina}
        />
      )}
    </div>
  );
}

function SemExecucoes({ pagina }: { pagina: number }) {
  // uma página além do fim (link velho, número digitado): volta para o começo
  if (pagina > 0) {
    return (
      <div className="vg-inicio">
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Esta página do histórico está vazia.</h2>
        <Link href="/historico" className="btn btn-secondary">
          Ir para as mais recentes
        </Link>
      </div>
    );
  }
  return (
    <div className="vg-inicio">
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400 }}>Nenhuma conciliação ainda.</h2>
      <p className="vg-inicio-texto">
        O histórico começa na primeira vez que você concilia o extrato do banco com o do sistema de
        gestão.
      </p>
      <Link href="/conciliacoes/nova" className="btn btn-primary">
        Nova conciliação
      </Link>
    </div>
  );
}

/** Só as rodadas atuais: a refeita depois substitui a anterior e não soma de novo. */
function Resumo({ execucoes, parcial }: { execucoes: Execucao[]; parcial: boolean }) {
  const atuais = execucoes.filter((execucao) => execucao.atual);
  const lancamentos = atuais.reduce((soma, execucao) => soma + execucao.lancamentos, 0);
  const conciliados = atuais.reduce(
    (soma, execucao) => soma + (segmentos(execucao).find((parte) => parte.tom === "ok")?.quantidade ?? 0),
    0,
  );

  return (
    <div>
      <dl className="grade-colunas dash-resumo hist-resumo">
        <div>
          <dt className="dash-rotulo">Conciliações atuais</dt>
          <dd className="dash-valor">{formatarInteiro(atuais.length)}</dd>
        </div>
        <div>
          <dt className="dash-rotulo">Lançamentos processados</dt>
          <dd className="dash-valor">{formatarInteiro(lancamentos)}</dd>
        </div>
        <div>
          <dt className="dash-rotulo">Casaram sozinhos</dt>
          <dd className="dash-valor">
            {formatarInteiro(conciliados)}
            {lancamentos > 0 && (
              <span className="hist-resumo-taxa">{formatarPercentual((conciliados / lancamentos) * 100)}</span>
            )}
          </dd>
        </div>
      </dl>
      {parcial && <p className="vg-nota" style={{ margin: "10px 0 0" }}>Somando as execuções desta página.</p>}
    </div>
  );
}

function Historico({
  execucoes,
  total,
  pagina,
  porPagina,
}: {
  execucoes: Execucao[];
  total: number;
  pagina: number;
  porPagina: number;
}) {
  const inicio = pagina * porPagina;
  const temAnterior = pagina > 0;
  const temProxima = inicio + execucoes.length < total;

  return (
    <div className="hist-corpo">
      <Resumo execucoes={execucoes} parcial={temAnterior || temProxima} />

      <GraficoDeMatch execucoes={execucoes} />

      <div>
        <LinhaDoTempo execucoes={execucoes} />

        {(temAnterior || temProxima) && (
          <nav className="paginacao" aria-label="Páginas do histórico">
            <span className="paginacao-conta">
              {`${formatarInteiro(inicio + 1)}–${formatarInteiro(inicio + execucoes.length)} de ${formatarInteiro(total)}`}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {temAnterior && (
                <Link href={pagina === 1 ? "/historico" : `/historico?pagina=${pagina - 1}`} className="btn btn-secondary">
                  Mais recentes
                </Link>
              )}
              {temProxima && (
                <Link href={`/historico?pagina=${pagina + 1}`} className="btn btn-secondary">
                  Mais antigas
                </Link>
              )}
            </div>
          </nav>
        )}
        {execucoes.some((execucao) => !execucao.atual) && (
          <p className="vg-nota" style={{ margin: "14px 0 0" }}>
            {NOTA_VER_ATUAL}
          </p>
        )}
      </div>
    </div>
  );
}

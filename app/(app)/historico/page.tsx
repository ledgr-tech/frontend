import Link from "next/link";
import { redirect } from "next/navigation";
import type { Execucao } from "@/lib/adaptadores";
import { execucoesVigentes } from "@/lib/rodadas";
import { listarExecucoes } from "../conciliacoes/acoes";
import { formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { conciliados as conciliadosDa } from "./execucoes";
import { Reveal } from "@/app/reveal";
import { GraficoDeMatch } from "./grafico";
import { ExportarHistorico, HistoricoPorConciliacao } from "./por-conciliacao";
import { Cabecalho } from "../cabecalho";

/**
 * O histórico lê `GET /execucoes` no servidor, uma página por vez, e junta as
 * execuções por extrato do banco: uma linha por conciliação, com as rodadas dela
 * (spec 2026-10-02-conciliacao-em-rodadas), agrupadas pelo mês em que a rodada que
 * vale rodou. O backend conta por execução e não sabe a competência do extrato,
 * então a tabela "mês a mês" do design segue fora, assim como o ajuste em reais, o
 * "fechado com ressalva" e a economia acumulada — nada disso tem fonte ainda.
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
      <Cabecalho
        titulo="Histórico"
        contexto={[
          resposta.ok &&
            `${formatarInteiro(resposta.dados.total)} ${resposta.dados.total === 1 ? "execução" : "execuções"}`,
        ]}
        acoes={
          resposta.ok &&
          resposta.dados.execucoes.length > 0 && <ExportarHistorico execucoes={resposta.dados.execucoes} />
        }
      />

      {!resposta.ok ? (
        <p role="alert" className="extratos-vazio">
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

/**
 * Só a rodada que vale de cada conciliação, como Fechamentos e a visão geral contam: a
 * refeita e a rodada anterior foram substituídas e não somam de novo.
 */
function Resumo({ vigentes, parcial }: { vigentes: Execucao[]; parcial: boolean }) {
  const lancamentos = vigentes.reduce((soma, execucao) => soma + execucao.lancamentos, 0);
  const conciliados = vigentes.reduce((soma, execucao) => soma + conciliadosDa(execucao), 0);

  return (
    <div>
      <dl className="grade-colunas dash-resumo hist-resumo">
        <div>
          <dt className="dash-rotulo">Conciliações</dt>
          <dd className="dash-valor">{formatarInteiro(vigentes.length)}</dd>
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
      {parcial && <p className="vg-nota hist-resumo-nota">Somando as execuções desta página.</p>}
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
  const vigentes = execucoesVigentes(execucoes);

  return (
    <div className="hist-corpo">
      <Reveal>
        <Resumo vigentes={vigentes} parcial={temAnterior || temProxima} />
      </Reveal>

      <Reveal delay={0.08}>
        <GraficoDeMatch execucoes={vigentes} />
      </Reveal>

      <Reveal delay={0.16}>
        <HistoricoPorConciliacao execucoes={execucoes} />

        {(temAnterior || temProxima) && (
          <nav className="paginacao" aria-label="Páginas do histórico">
            <span className="paginacao-conta">
              {`${formatarInteiro(inicio + 1)}–${formatarInteiro(inicio + execucoes.length)} de ${formatarInteiro(total)}`}
            </span>
            <div className="paginacao-botoes">
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
      </Reveal>
    </div>
  );
}

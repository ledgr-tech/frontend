import Link from "@/lib/link-do-app";
import { redirecionarNoApp } from "@/lib/rotas-servidor";
import type { Execucao } from "@/lib/adaptadores";
import { execucoesVigentes } from "@/lib/rodadas";
import { listarExecucoes } from "../conciliacoes/acoes";
import { formatarInteiro } from "../dashboard/resumo";
import { Reveal } from "@/app/reveal";
import { GraficoDeMatch } from "./grafico";
import { ExportarHistorico, HistoricoPorConciliacao } from "./por-conciliacao";
import { Cabecalho } from "../cabecalho";

/**
 * O histórico lê `GET /execucoes` no servidor, uma página por vez, e junta as
 * execuções por extrato do banco: uma linha por conciliação, com as rodadas dela
 * (spec 2026-10-02-conciliacao-em-rodadas), agrupadas pelo mês do extrato, como
 * Fechamentos. O backend conta por execução e não guarda ajuste em reais, "fechado
 * com ressalva" nem economia acumulada, então isso do design segue fora.
 */

const FALHA_AO_CARREGAR =
  "Não foi possível carregar o histórico. Recarregue a página e tente de novo.";

/** "3 conciliações nesta página", ou nada sem execução. */
function conciliacoesDaPagina(execucoes: Execucao[]): string | null {
  const quantas = new Set(execucoes.map((execucao) => execucao.extratoBancoId)).size;
  return quantas === 0 ? null : `${formatarInteiro(quantas)} ${quantas === 1 ? "conciliação" : "conciliações"} nesta página`;
}

/** "?pagina=2" → 2; qualquer outra coisa → a primeira. */
function lerPagina(valor: string | string[] | undefined): number {
  const numero = Number.parseInt(String(valor ?? ""), 10);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : 0;
}

export default async function HistoricoPage({ searchParams }: PageProps<"/e/[empresa]/historico">) {
  const pagina = lerPagina((await searchParams).pagina);
  const resposta = await listarExecucoes(pagina);
  if (!resposta.ok && resposta.status === 401) await redirecionarNoApp("/login");

  return (
    <div>
      <Cabecalho
        titulo="Histórico"
        contexto={[
          resposta.ok &&
            `${formatarInteiro(resposta.dados.total)} ${resposta.dados.total === 1 ? "execução" : "execuções"}`,
          // as conciliações desta página: o backend conta execuções, não extratos do banco
          resposta.ok && conciliacoesDaPagina(resposta.dados.execucoes),
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
        <GraficoDeMatch execucoes={vigentes} />
      </Reveal>

      <Reveal delay={0.08}>
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

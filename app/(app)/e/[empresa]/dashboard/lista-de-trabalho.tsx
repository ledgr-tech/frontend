"use client";

import { useRef, useState } from "react";
import Link from "@/lib/link-do-app";
import { useRoteador } from "@/lib/roteador";
import type { Fechamento } from "@/lib/adaptadores";
import { caminhoDaConciliacao, caminhoDoFechamento } from "@/lib/caminhos";
import type { ListaDeConciliacoes } from "../conciliacoes/acoes";
import { NovaVersao } from "../conciliacoes/[id]/nova-versao";
import { tituloDaCompetencia } from "../fechamentos/fechamento";
import { FaixaFiltros } from "../faixa-filtros";
import { IconeOrigem } from "../icone-origem";
import { conciliados, segmentos } from "../historico/execucoes";
import { BarraDoResultado } from "../historico/por-conciliacao";
import { formatarDataHora, formatarInteiro } from "./resumo";
import { useTrocaSuave } from "@/lib/troca-suave";
import {
  agruparPorMes,
  passaNoFiltro,
  pedemDecisao,
  seloDaConciliacao,
  type ConciliacaoNaLista,
  type FiltroDaLista,
  type MesNaLista,
} from "./lista";

/**
 * A lista de trabalho como folhas (revisão de 27/10, ideia 13 do artefato da tela): cada conciliação
 * é o par de folhas do banco e do sistema, agrupadas pelo mês, e ao lado a prévia da escolhida, com o
 * que bate, a barra com a legenda, a situação, a rodada, o mês e as ações. A primeira da fila já abre
 * escolhida, então a prévia faz o papel do antigo "Continue de onde parou". Um clique escolhe; dois
 * abrem a comparação. Fica no cliente pelo filtro e pela escolha; as conciliações chegam prontas da
 * página, que roda no servidor.
 */

const FILTROS: { id: FiltroDaLista; rotulo: string; vazio: string }[] = [
  { id: "pendentes", rotulo: "Pedem decisão", vazio: "Nenhuma conciliação pede decisão." },
  { id: "prontas", rotulo: "Sem pendência", vazio: "Toda conciliação de mês aberto ainda pede alguma decisão." },
  { id: "fechadas", rotulo: "Mês fechado", vazio: "Nenhum mês fechado ainda." },
  { id: "todas", rotulo: "Todas", vazio: "Nenhuma conciliação." },
];

// abaixo disso a prévia sobe para antes das folhas (o mesmo corte do .conc-mesa em globals.css)
const PREVIA_AO_LADO = "(min-width: 1100px)";

type Contagem = NonNullable<ListaDeConciliacoes["emAndamento"]>;

function plural(quantidade: number, singular: string, varios: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : varios}`;
}

function textoDaRodada({ rodada, rodadas }: ConciliacaoNaLista): string {
  return rodadas > 1 ? `Rodada ${rodada} de ${rodadas}` : `Rodada ${rodada}`;
}

export function ListaDeTrabalho({
  conciliacoes,
  fechamentos,
  parcial,
  emAndamento,
}: {
  conciliacoes: ConciliacaoNaLista[];
  fechamentos: Fechamento[] | null;
  parcial: boolean;
  /** A primeira da fila que pede decisão, com as conferidas (que só ela traz). */
  emAndamento: Contagem | null;
}) {
  const meses = agruparPorMes(conciliacoes, fechamentos);
  const contar = (filtro: FiltroDaLista) =>
    meses.reduce(
      (soma, mes) => soma + mes.conciliacoes.filter((item) => passaNoFiltro(item, mes.fechamento !== null, filtro)).length,
      0,
    );
  // abre no que pede trabalho; sem nada pendente, em todas
  const [filtro, setFiltro] = useState<FiltroDaLista>(() => (contar("pendentes") > 0 ? "pendentes" : "todas"));
  const [escolhida, setEscolhida] = useState<string | null>(emAndamento?.extratoBancoId ?? null);
  const previa = useRef<HTMLElement>(null);
  const visiveis = meses
    .map((mes) => ({ mes, linhas: mes.conciliacoes.filter((item) => passaNoFiltro(item, mes.fechamento !== null, filtro)) }))
    .filter(({ linhas }) => linhas.length > 0);
  // a escolhida que o filtro escondeu dá lugar à primeira à vista
  const emVista = visiveis.flatMap(({ mes, linhas }) => linhas.map((conciliacao) => ({ conciliacao, mes })));
  const atual = emVista.find((item) => item.conciliacao.extratoBancoId === escolhida) ?? emVista[0] ?? null;
  useTrocaSuave(previa, atual?.conciliacao.extratoBancoId);

  function escolher(id: string) {
    setEscolhida(id);
    // com a prévia acima das folhas, escolher sem ver o que mudou não diria nada
    if (!window.matchMedia?.(PREVIA_AO_LADO).matches) previa.current?.scrollIntoView?.({ block: "start" });
  }

  return (
    <div className="extratos-corpo">
      <FaixaFiltros tutorial="filtros">
        <div className="pills segmentado" role="group" aria-label="Filtrar conciliações">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pill"
              aria-pressed={filtro === item.id}
              onClick={() => setFiltro(item.id)}
            >
              {item.rotulo} ({contar(item.id)})
            </button>
          ))}
        </div>
        {/* as rodadas anteriores e o que já aconteceu ficam no histórico */}
        <Link href="/historico" className="btn btn-ghost conc-historico">
          Ver o histórico
        </Link>
      </FaixaFiltros>

      {!atual ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <div className="conc-mesa">
          <div className="conc-meses" data-tutorial="lista">
            {visiveis.map(({ mes, linhas }) => (
              <section key={mes.chave} aria-labelledby={`conc-mes-${mes.chave}`}>
                <CabecalhoDoMes mes={mes} />
                <ul className="conc-folhas">
                  {linhas.map((conciliacao) => (
                    <li key={conciliacao.extratoBancoId}>
                      <Folha
                        conciliacao={conciliacao}
                        mesFechado={mes.fechamento !== null}
                        escolhida={conciliacao.extratoBancoId === atual.conciliacao.extratoBancoId}
                        onEscolher={() => escolher(conciliacao.extratoBancoId)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Previa
            ref={previa}
            conciliacao={atual.conciliacao}
            mes={atual.mes}
            conferidas={emAndamento?.extratoBancoId === atual.conciliacao.extratoBancoId ? emAndamento.conferidas : null}
          />
        </div>
      )}
      {parcial && (
        <p className="vg-nota">
          A lista mostra as conciliações das últimas 50 execuções. As anteriores estão no histórico.
        </p>
      )}
    </div>
  );
}

function CabecalhoDoMes({ mes }: { mes: MesNaLista }) {
  const { fechamento } = mes;
  const quantas = plural(mes.conciliacoes.length, "conciliação", "conciliações");
  const meta = fechamento
    ? `Fechado em ${formatarDataHora(fechamento.fechadoEm).slice(0, 10)} por ${fechamento.fechadoPor} · ${quantas}`
    : [
        "Aberto",
        quantas,
        mes.pedemDecisao > 0 && `${plural(mes.pedemDecisao, "linha pede", "linhas pedem")} decisão`,
      ]
        .filter(Boolean)
        .join(" · ");
  return (
    <div className="conc-mes">
      <h2 id={`conc-mes-${mes.chave}`} className="conc-mes-titulo">
        {mes.titulo}
      </h2>
      <span className="conc-mes-meta">{meta}</span>
    </div>
  );
}

function seloDaFolha(conciliacao: ConciliacaoNaLista, mesFechado: boolean) {
  return mesFechado ? { rotulo: "Mês fechado", tom: "neutro" } : seloDaConciliacao(conciliacao);
}

function Selo({ selo }: { selo: { rotulo: string; tom: string } }) {
  return <span className={selo.tom === "neutro" ? "selo" : `selo selo-${selo.tom}`}>{selo.rotulo}</span>;
}

/** O par de folhas de uma conciliação: a do banco por cima, a do sistema atrás, como na comparação. */
function Folha({
  conciliacao,
  mesFechado,
  escolhida,
  onEscolher,
}: {
  conciliacao: ConciliacaoNaLista;
  mesFechado: boolean;
  escolhida: boolean;
  onEscolher: () => void;
}) {
  const router = useRoteador();
  const { extratoBancoId, arquivoBanco, arquivoSistema, execucao } = conciliacao;
  return (
    <button
      type="button"
      className="conc-folha"
      aria-pressed={escolhida}
      onClick={onEscolher}
      // atalho para a comparação, como o duplo clique na linha dela; o clique simples só escolhe
      onDoubleClick={() => router.push(caminhoDaConciliacao(extratoBancoId))}
    >
      <span className="conc-folha-par" aria-hidden="true">
        <span className="conc-folha-banco">
          <span className="hist-arquivo">
            <IconeOrigem origem="banco" tamanho={14} />
            <span className="hist-arquivo-nome">{arquivoBanco}</span>
          </span>
          <span className="conc-folha-linhas">
            <i />
            <i />
            <i />
          </span>
        </span>
        <span className="conc-folha-sistema">
          <span className="hist-arquivo hist-arquivo-sistema">
            <IconeOrigem origem="sistema" tamanho={13} />
            <span className="hist-arquivo-nome">{arquivoSistema}</span>
          </span>
        </span>
      </span>
      <span className="sr-only">{`${arquivoBanco} × ${arquivoSistema}`}</span>
      <span className="conc-progresso">
        {execucao.lancamentos > 0 && <BarraDoResultado execucao={execucao} />}
        <span className="conc-folha-pe">
          <span>{`${formatarInteiro(conciliados(execucao))} de ${formatarInteiro(execucao.lancamentos)} batem`}</span>
          <Selo selo={seloDaFolha(conciliacao, mesFechado)} />
        </span>
      </span>
      <span className="conc-folha-pe">
        <span>{formatarDataHora(execucao.executadaEm)}</span>
        <span>{textoDaRodada(conciliacao)}</span>
      </span>
    </button>
  );
}

/** A conciliação escolhida, ao lado das folhas: o número do que bate, a barra explicada e o caminho. */
function Previa({
  ref,
  conciliacao,
  mes,
  conferidas,
}: {
  ref: React.Ref<HTMLElement>;
  conciliacao: ConciliacaoNaLista;
  mes: MesNaLista;
  /** Só a primeira da fila traz as conferidas; das outras, a linha não aparece. */
  conferidas: number | null;
}) {
  const router = useRoteador();
  const { extratoBancoId, arquivoBanco, arquivoSistema, execucao, competencia } = conciliacao;
  const { fechamento } = mes;
  const pendentes = pedemDecisao(conciliacao);
  const nomeDoMes = mes.titulo.split(" ")[0].toLowerCase();
  const titulo = fechamento
    ? "Mês fechado"
    : pendentes > 0
      ? `${plural(pendentes, "linha pede", "linhas pedem")} decisão`
      : "Sem pendência";
  return (
    <aside ref={ref} className="conc-previa" aria-label="Conciliação escolhida" aria-live="polite" data-tutorial="previa">
      <span className="rotulo">{tituloDaCompetencia(competencia)}</span>
      <h2 className="conc-previa-titulo">{titulo}</h2>
      <div className="conc-previa-arquivos">
        <span className="hist-arquivo">
          <IconeOrigem origem="banco" tamanho={14} />
          <span className="hist-arquivo-nome">{arquivoBanco}</span>
        </span>
        <span className="hist-arquivo hist-arquivo-sistema">
          <IconeOrigem origem="sistema" tamanho={13} />
          <span className="hist-arquivo-nome">{`× ${arquivoSistema}`}</span>
        </span>
      </div>
      <div className="extrato-resultado">
        <p className="conc-previa-numero">
          <strong>{formatarInteiro(conciliados(execucao))}</strong>
          {`de ${plural(execucao.lancamentos, "lançamento bate", "lançamentos batem")}`}
        </p>
        {execucao.lancamentos > 0 && (
          <>
            <BarraDoResultado execucao={execucao} />
            <ul className="conc-previa-legenda" aria-label="O que a barra mostra">
              {segmentos(execucao).map((parte) => (
                <li key={parte.tom}>
                  <span className="hist-legenda-cor" data-tom={parte.tom} aria-hidden="true" />
                  {`${formatarInteiro(parte.quantidade)} · ${parte.rotulo}`}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <dl className="conc-previa-dados">
        <dt>Situação</dt>
        <dd>
          <Selo selo={seloDaFolha(conciliacao, fechamento !== null)} />
        </dd>
        {execucao.justificadas > 0 && (
          <>
            <dt>Justificadas</dt>
            <dd>{formatarInteiro(execucao.justificadas)}</dd>
          </>
        )}
        {conferidas !== null && !fechamento && (
          <>
            <dt>Conferidas</dt>
            <dd>{`${formatarInteiro(conferidas)} de ${formatarInteiro(pendentes)}`}</dd>
          </>
        )}
        <dt>Rodada</dt>
        <dd>{`${textoDaRodada(conciliacao)} · ${formatarDataHora(execucao.executadaEm)}`}</dd>
        <dt>Mês</dt>
        <dd>
          {fechamento ? `Fechado em ${formatarDataHora(fechamento.fechadoEm).slice(0, 10)} por ${fechamento.fechadoPor} · ` : "Aberto · "}
          <Link href={caminhoDoFechamento(mes.chave)} className="conc-mes-link">
            {fechamento ? "Ver o fechamento" : `Fechamento de ${nomeDoMes}`}
          </Link>
        </dd>
      </dl>
      <div className="conc-previa-acoes">
        {/* pelo endereço só do banco, que abre a rodada que vale */}
        <Link href={caminhoDaConciliacao(extratoBancoId)} className="btn btn-primary">
          Abrir a comparação
        </Link>
        {/* como na comparação: com o mês fechado, nada se concilia de novo */}
        {!fechamento && (
          <NovaVersao
            extratoBancoId={extratoBancoId}
            rodadaAtual={{
              numero: conciliacao.rodada,
              total: conciliacao.rodadas,
              arquivo: arquivoSistema,
              em: execucao.executadaEm,
            }}
            onConcluida={() => router.push(caminhoDaConciliacao(extratoBancoId))}
          />
        )}
      </div>
    </aside>
  );
}

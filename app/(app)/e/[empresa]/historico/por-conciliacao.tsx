"use client";

import { Fragment, useRef, useState } from "react";
import Link from "@/lib/link-do-app";
import { useRoteador } from "@/lib/roteador";
import type { Execucao } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { salvar } from "../conciliacoes/[id]/exportar-csv";
import { formatarDataHora, formatarInteiro } from "../dashboard/resumo";
import { FaixaFiltros } from "../faixa-filtros";
import { IconeOrigem } from "../icone-origem";
import {
  LEGENDA_DOS_TONS,
  conciliados,
  matchNaTela,
  paraRevisar,
  porConciliacao,
  porMes,
  segmentos,
  taxaDeMatch,
  type ConciliacaoNoHistorico,
  type MesDoHistorico,
  type SituacaoNoHistorico,
} from "./execucoes";

/**
 * O histórico em folhas, como Conciliações (revisão de 29/10, versão B do artefato "Histórico e
 * Empresas no padrão"): cada extrato do banco é o par de folhas, agrupadas pelo mês do extrato, e ao
 * lado a prévia da escolhida, com o que bateu na rodada que vale e todas as rodadas que ela teve
 * (anteriores e refeitas). Um clique escolhe; dois abrem a comparação. Fica no cliente pelo filtro e
 * pela escolha; as execuções chegam prontas da página, que roda no servidor.
 */

type Filtro = "todas" | "pendentes";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todas", rotulo: "Todas", vazio: "Nenhuma conciliação nesta página." },
  { id: "pendentes", rotulo: "Com pendência", vazio: "Nenhuma conciliação com pendência nesta página." },
];

// abaixo disso a prévia sobe para antes das folhas (o mesmo corte do .conc-mesa em globals.css)
const PREVIA_AO_LADO = "(min-width: 1100px)";

function comPendencia(conciliacao: ConciliacaoNoHistorico): boolean {
  return paraRevisar(conciliacao.principal.execucao) > 0;
}

function passaNoFiltro(conciliacao: ConciliacaoNoHistorico, filtro: Filtro): boolean {
  return filtro === "todas" || comPendencia(conciliacao);
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

/**
 * "24/09 14:02" quando rodou no ano do mês do extrato, que o título já diz; com o ano quando não (o
 * extrato de dezembro conciliado em janeiro).
 */
function quandoRodou(iso: string, ano: string): string {
  const completa = formatarDataHora(iso);
  return completa.slice(6, 10) === ano ? completa.replace(/\/\d{4}/, "") : completa;
}

function textoDaRodada({ principal, rodadas }: ConciliacaoNoHistorico): string {
  return `Rodada ${principal.rodada} de ${rodadas}`;
}

const SELO: Record<SituacaoNoHistorico, { rotulo: string; classe: string }> = {
  vale: { rotulo: "Vale", classe: "selo selo-ok" },
  anterior: { rotulo: "Anterior", classe: "selo" },
  // refeita depois com os mesmos arquivos: o traço diz que está no histórico mas não vale
  substituida: { rotulo: "Substituída", classe: "selo hist-selo-substituida" },
};

function metaDoMes(mes: MesDoHistorico): string {
  const pendentes = mes.conciliacoes.filter(comPendencia).length;
  return [
    plural(mes.conciliacoes.length, "conciliação", "conciliações"),
    pendentes > 0 ? `${formatarInteiro(pendentes)} com pendência` : "sem pendência",
  ].join(" · ");
}

export function HistoricoPorConciliacao({ execucoes }: { execucoes: Execucao[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const previa = useRef<HTMLElement>(null);
  const todas = porConciliacao(execucoes);
  const meses = porMes(todas.filter((conciliacao) => passaNoFiltro(conciliacao, filtro)));
  // a escolhida que o filtro escondeu dá lugar à primeira à vista
  const emVista = meses.flatMap((mes) => mes.conciliacoes.map((conciliacao) => ({ conciliacao, mes })));
  const atual = emVista.find((item) => item.conciliacao.extratoBancoId === escolhida) ?? emVista[0] ?? null;

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
              {item.rotulo} ({todas.filter((conciliacao) => passaNoFiltro(conciliacao, item.id)).length})
            </button>
          ))}
        </div>
        <ul className="hist-legenda" aria-label="Legenda das barras">
          {LEGENDA_DOS_TONS.map((item) => (
            <li key={item.tom}>
              <span className="hist-legenda-cor" data-tom={item.tom} aria-hidden="true" />
              {item.rotulo}
            </li>
          ))}
        </ul>
      </FaixaFiltros>

      {!atual ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <div className="conc-mesa">
          <div className="conc-meses" data-tutorial="lista">
            {meses.map((mes) => (
              <section key={mes.chave} aria-labelledby={`hist-mes-${mes.chave}`}>
                <div className="conc-mes">
                  <h2 id={`hist-mes-${mes.chave}`} className="conc-mes-titulo">
                    {mes.titulo}
                  </h2>
                  <span className="conc-mes-meta">{metaDoMes(mes)}</span>
                </div>
                <ul className="conc-folhas">
                  {mes.conciliacoes.map((conciliacao) => (
                    <li key={conciliacao.extratoBancoId}>
                      <Folha
                        conciliacao={conciliacao}
                        ano={mes.chave.slice(0, 4)}
                        escolhida={conciliacao.extratoBancoId === atual.conciliacao.extratoBancoId}
                        onEscolher={() => escolher(conciliacao.extratoBancoId)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Previa ref={previa} conciliacao={atual.conciliacao} mes={atual.mes} />
        </div>
      )}
    </div>
  );
}

/** O selo da folha: o que ainda pede revisão na rodada que vale, ou que não sobrou nada. */
function SeloDaPendencia({ conciliacao }: { conciliacao: ConciliacaoNoHistorico }) {
  const revisar = paraRevisar(conciliacao.principal.execucao);
  return revisar > 0 ? (
    <span className="selo selo-risco">{`${formatarInteiro(revisar)} para revisar`}</span>
  ) : (
    <span className="selo selo-ok">Sem pendência</span>
  );
}

/** O par de folhas de uma conciliação, como em Conciliações, com as rodadas no pé. */
function Folha({
  conciliacao,
  ano,
  escolhida,
  onEscolher,
}: {
  conciliacao: ConciliacaoNoHistorico;
  /** O ano do mês do extrato, que o título do mês já diz. */
  ano: string;
  escolhida: boolean;
  onEscolher: () => void;
}) {
  const router = useRoteador();
  const { extratoBancoId, arquivoBanco, principal, rodadas } = conciliacao;
  const { execucao } = principal;
  return (
    <button
      type="button"
      className="conc-folha"
      aria-pressed={escolhida}
      onClick={onEscolher}
      // atalho para a comparação, como em Conciliações; o clique simples só escolhe
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
            <span className="hist-arquivo-nome">{execucao.arquivoSistema}</span>
          </span>
        </span>
      </span>
      <span className="sr-only">{`${arquivoBanco} × ${execucao.arquivoSistema}`}</span>
      <span className="conc-progresso">
        {execucao.lancamentos > 0 && <BarraDoResultado execucao={execucao} />}
        <span className="conc-folha-pe">
          <span className="hist-taxa">{`${matchNaTela(execucao)} bateu`}</span>
          <SeloDaPendencia conciliacao={conciliacao} />
        </span>
      </span>
      <span className="conc-folha-pe">
        <time dateTime={execucao.executadaEm} title={formatarDataHora(execucao.executadaEm)}>
          {quandoRodou(execucao.executadaEm, ano)}
        </time>
        <QuadradosDasRodadas rodada={principal.rodada} rodadas={rodadas} />
        <span className="sr-only">{textoDaRodada(conciliacao)}</span>
      </span>
    </button>
  );
}

/** A conciliação escolhida, ao lado das folhas: o que bateu na rodada que vale e cada execução que ela teve. */
function Previa({
  ref,
  conciliacao,
  mes,
}: {
  ref: React.Ref<HTMLElement>;
  conciliacao: ConciliacaoNoHistorico;
  mes: MesDoHistorico;
}) {
  const { extratoBancoId, arquivoBanco, principal, execucoes } = conciliacao;
  const { execucao } = principal;
  const revisar = paraRevisar(execucao);
  const ano = mes.chave.slice(0, 4);
  return (
    <aside ref={ref} className="conc-previa" aria-label="Conciliação escolhida" aria-live="polite" data-tutorial="previa">
      <span className="rotulo">{mes.titulo}</span>
      <h2 className="conc-previa-titulo">{textoDaRodada(conciliacao)}</h2>
      <div className="conc-previa-arquivos">
        <span className="hist-arquivo">
          <IconeOrigem origem="banco" tamanho={14} />
          <span className="hist-arquivo-nome">{arquivoBanco}</span>
        </span>
        <span className="hist-arquivo hist-arquivo-sistema">
          <IconeOrigem origem="sistema" tamanho={13} />
          <span className="hist-arquivo-nome">{`× ${execucao.arquivoSistema}`}</span>
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
        <dt>Para revisar</dt>
        <dd>
          {revisar > 0 ? plural(revisar, "linha", "linhas") : "Nada"}
          {execucao.justificadas > 0 && ` · ${plural(execucao.justificadas, "justificada", "justificadas")}`}
        </dd>
        <dt>Tolerância</dt>
        <dd>{execucao.toleranciaDias === 1 ? "1 dia" : `${formatarInteiro(execucao.toleranciaDias)} dias`}</dd>
        <dt>Rodou em</dt>
        <dd>{formatarDataHora(execucao.executadaEm)}</dd>
      </dl>
      {execucoes.length > 1 && (
        <div className="hist-previa-rodadas">
          <h3 className="hist-previa-rodadas-titulo">Execuções desta conciliação</h3>
          <ol className="hist-previa-execucoes" aria-label={`Execuções de ${arquivoBanco}`}>
            {execucoes.map(({ execucao: item, rodada, situacao }) => {
              const selo = SELO[situacao];
              return (
                <li key={item.id} className="hist-previa-execucao" data-situacao={situacao}>
                  <span className="hist-previa-execucao-nome">{`Rodada ${rodada} · ${item.arquivoSistema}`}</span>
                  <span className={selo.classe}>{selo.rotulo}</span>
                  <span className="hist-previa-execucao-numeros">
                    <time dateTime={item.executadaEm}>{quandoRodou(item.executadaEm, ano)}</time>
                    {` · ${matchNaTela(item)} · ${plural(paraRevisar(item), "para revisar", "para revisar")}`}
                  </span>
                  {/* a rodada anterior ainda abre, com o aviso de que há uma mais recente; a refeita não:
                      o backend só guarda o resultado mais novo de cada par */}
                  {situacao === "anterior" && (
                    <Link
                      href={caminhoDaConciliacao(item.extratoBancoId, item.extratoSistemaId)}
                      className="btn btn-ghost hist-previa-execucao-ver"
                      aria-label={`Ver a rodada ${rodada}`}
                    >
                      Ver
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <div className="conc-previa-acoes">
        {/* pelo endereço só do banco, que abre a rodada que vale */}
        <Link href={caminhoDaConciliacao(extratoBancoId)} className="btn btn-primary">
          Abrir a comparação
        </Link>
      </div>
    </aside>
  );
}

/**
 * Os quadrados das rodadas, ligados pelo fio, com o da rodada que vale cheio: o desenho da faixa
 * da comparação, menor. Só para o olho; quem usa diz a rodada em texto ao lado.
 */
export function QuadradosDasRodadas({ rodada, rodadas }: { rodada: number; rodadas: number }) {
  return (
    <span className="hist-rodadas" aria-hidden="true">
      {Array.from({ length: rodadas }, (_, indice) => (
        <Fragment key={indice}>
          {indice > 0 && <span className="rodadas-fio" />}
          <span className="rodadas-quadrado" data-vale={indice + 1 === rodada || undefined}>
            {indice + 1}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

/** A barra do que casou e do que pediu revisão; quem usa diz o mesmo em texto ao lado. */
export function BarraDoResultado({ execucao }: { execucao: Execucao }) {
  return (
    <span className="hist-resultado-barra" aria-hidden="true">
      {segmentos(execucao).map((parte) => (
        <span
          key={parte.tom}
          data-tom={parte.tom}
          style={{ flexGrow: parte.quantidade }}
          title={`${parte.rotulo}: ${formatarInteiro(parte.quantidade)}`}
        />
      ))}
    </span>
  );
}

// Arquivo com nome que começa em = + - @ (ou tab, ou retorno de carro) abriria
// no Excel como fórmula: o apóstrofo na frente desliga isso, como o backend faz
// no CSV da conciliação.
function celula(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

const SITUACAO_NO_CSV: Record<SituacaoNoHistorico, string> = {
  vale: "Vale",
  anterior: "Anterior",
  substituida: "Substituída",
};

/** O histórico desta página em CSV, no padrão Excel BR: ponto e vírgula, BOM e CRLF. Uma linha por execução. */
export function csvDoHistorico(execucoes: Execucao[]): string {
  const porId = new Map(
    porConciliacao(execucoes).flatMap((conciliacao) => conciliacao.execucoes.map((item) => [item.execucao.id, item])),
  );
  const cabecalho = [
    "Executada em",
    "Arquivo do banco",
    "Rodada",
    "Arquivo do sistema",
    "Lançamentos",
    "Conciliados",
    "Justificadas",
    "Match",
    "Tolerância (dias)",
    "Situação",
  ];
  const linhas = execucoes.map((execucao) => {
    const item = porId.get(execucao.id)!;
    // pelas contagens, como as telas: o mesmo número da coluna Conciliados
    const taxa = taxaDeMatch(execucao);
    return [
      formatarDataHora(execucao.executadaEm),
      execucao.arquivoBanco,
      String(item.rodada),
      execucao.arquivoSistema,
      String(execucao.lancamentos),
      String(conciliados(execucao)),
      String(execucao.justificadas),
      taxa === null ? "" : taxa.toFixed(2).replace(".", ","),
      String(execucao.toleranciaDias),
      SITUACAO_NO_CSV[item.situacao],
    ]
      .map(celula)
      .join(";");
  });
  return "﻿" + [cabecalho.join(";"), ...linhas].join("\r\n");
}

export function ExportarHistorico({ execucoes }: { execucoes: Execucao[] }) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() =>
        salvar(new Blob([csvDoHistorico(execucoes)], { type: "text/csv;charset=utf-8" }), "ledgr-historico.csv")
      }
    >
      Exportar histórico
    </button>
  );
}

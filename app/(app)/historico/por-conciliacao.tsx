"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Execucao } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { salvar } from "../conciliacoes/[id]/exportar-csv";
import { formatarDataHora, formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { FaixaFiltros } from "../faixa-filtros";
import { Grupo, alternarNoConjunto } from "../grupo";
import { IconeOrigem } from "../icone-origem";
import {
  LEGENDA_DOS_TONS,
  conciliados,
  paraRevisar,
  porAno,
  porConciliacao,
  porMes,
  segmentos,
  type ConciliacaoNoHistorico,
  type ExecucaoDaConciliacao,
  type MesDoHistorico,
  type SituacaoNoHistorico,
} from "./execucoes";

/**
 * O histórico conciliação a conciliação: uma linha por extrato do banco, com os números da
 * rodada que vale, e as outras execuções dele (rodadas anteriores, refeitas) abertas embaixo.
 * Agrupado por ano e mês, como Fechamentos. Fica no cliente pelo filtro e pelo que está aberto;
 * as execuções chegam prontas da página, que roda no servidor.
 */

type Filtro = "todas" | "pendentes";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todas", rotulo: "Todas", vazio: "Nenhuma conciliação nesta página." },
  { id: "pendentes", rotulo: "Com pendência", vazio: "Nenhuma conciliação com pendência nesta página." },
];

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
 * "24/09 14:02" quando rodou no ano do grupo, que o título já diz; com o ano quando não (o
 * extrato de dezembro conciliado em janeiro).
 */
function quandoRodou(iso: string, ano: string): string {
  const completa = formatarDataHora(iso);
  return completa.slice(6, 10) === ano ? completa.replace(/\/\d{4}/, "") : completa;
}

const SELO: Record<SituacaoNoHistorico, { rotulo: string; classe: string }> = {
  vale: { rotulo: "Vale", classe: "selo selo-ok" },
  anterior: { rotulo: "Anterior", classe: "selo" },
  // refeita depois com os mesmos arquivos: o traço diz que está no histórico mas não vale
  substituida: { rotulo: "Substituída", classe: "selo hist-selo-substituida" },
};

function resumoDoAno(meses: MesDoHistorico[]): string {
  const doAno = meses.flatMap((mes) => mes.conciliacoes);
  const pendentes = doAno.filter(comPendencia).length;
  const situacao =
    pendentes > 0 ? `${formatarInteiro(pendentes)} com pendência` : doAno.length === 1 ? "sem pendência" : "todas sem pendência";
  return `${plural(doAno.length, "conciliação", "conciliações")} · ${situacao}`;
}

export function HistoricoPorConciliacao({
  execucoes,
  competencias = {},
}: {
  execucoes: Execucao[];
  /** O mês do extrato de cada extrato do banco (`carregarHistorico`); sem ele, o mês em que rodou. */
  competencias?: Record<string, string>;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const todas = porConciliacao(execucoes, competencias);
  const anos = porAno(porMes(todas.filter((conciliacao) => passaNoFiltro(conciliacao, filtro))));
  // os anos passados começam recolhidos: o que se procura no histórico costuma ser recente, e o
  // título de cada um já diz quantas conciliações ainda pedem revisão
  const [anosFechados, setAnosFechados] = useState<ReadonlySet<string>>(
    () => new Set(porAno(porMes(todas)).slice(1).map(({ ano }) => ano)),
  );
  const [abertas, setAbertas] = useState<ReadonlySet<string>>(new Set());

  return (
    <section className="hist-linha" aria-labelledby="hist-linha-titulo">
      <h2 id="hist-linha-titulo" className="vg-secao-titulo">
        Conciliação a conciliação
      </h2>
      <div className="extratos-corpo">
        <FaixaFiltros>
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

        {anos.length === 0 ? (
          <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
        ) : (
          <div className="grupos">
            {anos.map(({ ano, meses }) => {
              const tabela = (
                <Tabela
                  meses={meses}
                  abertas={abertas}
                  onAlternar={(banco) => setAbertas(alternarNoConjunto(banco))}
                />
              );
              // num ano só, a tabela segue sem o título do ano, como em Fechamentos
              return anos.length > 1 ? (
                <Grupo
                  key={ano}
                  id={`hist-ano-${ano}`}
                  titulo={ano}
                  resumo={resumoDoAno(meses)}
                  fechado={anosFechados.has(ano)}
                  onAlternar={() => setAnosFechados(alternarNoConjunto(ano))}
                >
                  {tabela}
                </Grupo>
              ) : (
                <Fragment key={ano}>{tabela}</Fragment>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Tabela({
  meses,
  abertas,
  onAlternar,
}: {
  meses: MesDoHistorico[];
  abertas: ReadonlySet<string>;
  onAlternar: (extratoBancoId: string) => void;
}) {
  return (
    <table className="table hist-tabela">
      <colgroup>
        <col className="hist-col-conciliacao" />
        <col className="hist-col-rodadas" />
        <col className="hist-col-lancamentos" />
        <col className="hist-col-match" />
        <col className="hist-col-revisar" />
        <col className="hist-col-quando" />
        <col className="hist-col-acao" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Conciliação</th>
          <th scope="col">Rodadas</th>
          <th scope="col" className="hist-num">
            Lançamentos
          </th>
          <th scope="col">Match</th>
          <th scope="col" className="hist-num">
            Para revisar
          </th>
          <th scope="col">Quando</th>
          <th scope="col">
            <span className="sr-only">Abrir</span>
          </th>
        </tr>
      </thead>
      {meses.map((mes) => (
        <tbody key={mes.chave}>
          <tr className="hist-mes-linha">
            <th scope="rowgroup" colSpan={7}>
              <h3 className="hist-mes-titulo">
                {mes.titulo}
                <span className="hist-mes-conta">{plural(mes.conciliacoes.length, "conciliação", "conciliações")}</span>
              </h3>
            </th>
          </tr>
          {mes.conciliacoes.map((conciliacao) => (
            <LinhasDaConciliacao
              key={conciliacao.extratoBancoId}
              conciliacao={conciliacao}
              ano={mes.chave.slice(0, 4)}
              aberta={abertas.has(conciliacao.extratoBancoId)}
              onAlternar={() => onAlternar(conciliacao.extratoBancoId)}
            />
          ))}
        </tbody>
      ))}
    </table>
  );
}

/** Um rótulo que só aparece na tela estreita, onde a tabela vira um bloco por linha e perde o cabeçalho. */
function RotuloMovel({ children }: { children: string }) {
  return (
    <span className="hist-rotulo-movel" aria-hidden="true">
      {children}
    </span>
  );
}

function LinhasDaConciliacao({
  conciliacao,
  ano,
  aberta,
  onAlternar,
}: {
  conciliacao: ConciliacaoNoHistorico;
  /** O ano do mês do extrato, que o título do grupo já diz. */
  ano: string;
  aberta: boolean;
  onAlternar: () => void;
}) {
  const { principal, execucoes, rodadas, arquivoBanco } = conciliacao;
  const { execucao } = principal;
  const idDasExecucoes = execucoes.map((item) => `hist-execucao-${item.execucao.id}`);
  const revisar = paraRevisar(execucao);

  return (
    <>
      <tr className="hist-conciliacao" data-pendente={revisar > 0 || undefined}>
        <td className="hist-c-conciliacao">
          <div className="hist-conciliacao-nome">
            {execucoes.length > 1 ? (
              <button
                type="button"
                className="hist-abrir"
                aria-expanded={aberta}
                aria-controls={idDasExecucoes.join(" ")}
                aria-label={`Execuções de ${arquivoBanco}`}
                onClick={onAlternar}
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <span className="hist-abrir-vazio" aria-hidden="true" />
            )}
            <span className="hist-arquivos">
              <span className="hist-arquivo">
                <IconeOrigem origem="banco" tamanho={14} />
                <span className="hist-arquivo-nome">{arquivoBanco}</span>
              </span>
              <span className="hist-arquivo hist-arquivo-sistema">
                <IconeOrigem origem="sistema" tamanho={13} />
                <span className="hist-arquivo-nome">{execucao.arquivoSistema}</span>
              </span>
            </span>
          </div>
        </td>
        <td className="hist-c-rodadas">
          <RotuloMovel>Rodadas</RotuloMovel>
          <span className="hist-rodadas" aria-hidden="true">
            {Array.from({ length: rodadas }, (_, indice) => (
              <Fragment key={indice}>
                {indice > 0 && <span className="rodadas-fio" />}
                <span className="rodadas-quadrado" data-vale={indice + 1 === principal.rodada || undefined}>
                  {indice + 1}
                </span>
              </Fragment>
            ))}
          </span>
          <span className="sr-only">{`Rodada ${principal.rodada} de ${rodadas}`}</span>
        </td>
        <td className="hist-c-lancamentos hist-num">
          <RotuloMovel>Lançamentos</RotuloMovel>
          {formatarInteiro(execucao.lancamentos)}
        </td>
        <td className="hist-c-match">
          <span className="hist-resultado">
            {execucao.lancamentos > 0 && <BarraDoResultado execucao={execucao} />}
            <span className="hist-taxa">{execucao.acerto === null ? "—" : formatarPercentual(execucao.acerto)}</span>
          </span>
        </td>
        <td className="hist-c-revisar hist-num">
          <RotuloMovel>Para revisar</RotuloMovel>
          {formatarInteiro(revisar)}
          {execucao.justificadas > 0 && (
            <span className="hist-justificadas">{` · ${plural(execucao.justificadas, "justificada", "justificadas")}`}</span>
          )}
        </td>
        <td className="hist-c-quando">
          <RotuloMovel>Quando</RotuloMovel>
          <time dateTime={execucao.executadaEm} title={formatarDataHora(execucao.executadaEm)}>
            {quandoRodou(execucao.executadaEm, ano)}
          </time>
        </td>
        <td className="hist-c-acao">
          {/* pelo endereço só do banco, que abre a rodada mais recente, como o "ver a mais recente" */}
          <Link href={caminhoDaConciliacao(conciliacao.extratoBancoId)} className="btn btn-secondary hist-ver">
            Ver<span className="sr-only"> {arquivoBanco}</span>
          </Link>
        </td>
      </tr>
      {execucoes.length > 1 &&
        execucoes.map((item, indice) => (
          <LinhaDaExecucao key={item.execucao.id} id={idDasExecucoes[indice]} item={item} ano={ano} aberta={aberta} />
        ))}
    </>
  );
}

function LinhaDaExecucao({
  id,
  item,
  ano,
  aberta,
}: {
  id: string;
  item: ExecucaoDaConciliacao;
  ano: string;
  aberta: boolean;
}) {
  const { execucao, rodada, situacao } = item;
  const selo = SELO[situacao];
  return (
    <tr id={id} className="hist-execucao" data-situacao={situacao} hidden={!aberta}>
      <td className="hist-c-conciliacao">
        <span className="hist-execucao-nome">{`Rodada ${rodada} · ${execucao.arquivoSistema}`}</span>
      </td>
      <td className="hist-c-rodadas">
        <span className={selo.classe}>{selo.rotulo}</span>
      </td>
      <td className="hist-c-lancamentos hist-num">
        <RotuloMovel>Lançamentos</RotuloMovel>
        {formatarInteiro(execucao.lancamentos)}
      </td>
      <td className="hist-c-match">
        <span className="hist-taxa">{execucao.acerto === null ? "—" : formatarPercentual(execucao.acerto)}</span>
      </td>
      <td className="hist-c-revisar hist-num">
        <RotuloMovel>Para revisar</RotuloMovel>
        {formatarInteiro(paraRevisar(execucao))}
      </td>
      <td className="hist-c-quando">
        <RotuloMovel>Quando</RotuloMovel>
        <time dateTime={execucao.executadaEm} title={formatarDataHora(execucao.executadaEm)}>
          {quandoRodou(execucao.executadaEm, ano)}
        </time>
      </td>
      <td className="hist-c-acao">
        {/* a rodada anterior ainda abre, com o aviso de que há uma mais recente; a refeita não:
            o backend só guarda o resultado mais novo de cada par */}
        {situacao === "anterior" && (
          <Link
            href={caminhoDaConciliacao(execucao.extratoBancoId, execucao.extratoSistemaId)}
            className="btn btn-secondary hist-ver"
            aria-label={`Ver a rodada ${rodada}`}
          >
            Ver
          </Link>
        )}
      </td>
    </tr>
  );
}

/** A barra do que casou e do que pediu revisão; a coluna ao lado diz o mesmo em texto. */
function BarraDoResultado({ execucao }: { execucao: Execucao }) {
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

// Arquivo com nome que começa em = + - @ abriria no Excel como fórmula: o
// apóstrofo na frente desliga isso, como o backend faz no CSV da conciliação.
function celula(valor: string): string {
  const seguro = /^[=+\-@\t]/.test(valor) ? `'${valor}` : valor;
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
    return [
      formatarDataHora(execucao.executadaEm),
      execucao.arquivoBanco,
      String(item.rodada),
      execucao.arquivoSistema,
      String(execucao.lancamentos),
      String(conciliados(execucao)),
      String(execucao.justificadas),
      execucao.acerto === null ? "" : execucao.acerto.toFixed(2).replace(".", ","),
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

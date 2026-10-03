"use client";

import { useState } from "react";
import Link from "next/link";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { FaixaFiltros } from "../faixa-filtros";
import { IconeOrigem } from "../icone-origem";
import { BarraDoResultado } from "../historico/por-conciliacao";
import { formatarInteiro, formatarPercentual } from "./resumo";
import {
  mesDaLista,
  ordemDeTrabalho,
  pedemDecisao,
  seloDaConciliacao,
  taxaDaConciliacao,
  type ConciliacaoNaLista,
} from "./lista";

/**
 * A lista de trabalho: cada conciliação uma vez, na rodada que vale, o que pede decisão primeiro.
 * Fica no cliente só pelo filtro; as conciliações chegam prontas da página, que roda no servidor.
 */

type Filtro = "pendentes" | "prontas" | "todas";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "pendentes", rotulo: "Com pendência", vazio: "Nenhuma conciliação pede decisão." },
  { id: "prontas", rotulo: "Sem pendência", vazio: "Toda conciliação ainda pede alguma decisão." },
  { id: "todas", rotulo: "Todas", vazio: "Nenhuma conciliação." },
];

function passaNoFiltro(conciliacao: ConciliacaoNaLista, filtro: Filtro): boolean {
  if (filtro === "pendentes") return pedemDecisao(conciliacao) > 0;
  if (filtro === "prontas") return pedemDecisao(conciliacao) === 0;
  return true;
}

/** Um rótulo que só aparece na tela estreita, onde a tabela vira um bloco por linha. */
function RotuloMovel({ children }: { children: string }) {
  return (
    <span className="hist-rotulo-movel" aria-hidden="true">
      {children}
    </span>
  );
}

export function ListaDeTrabalho({ conciliacoes, parcial }: { conciliacoes: ConciliacaoNaLista[]; parcial: boolean }) {
  // abre no que pede trabalho; sem nada pendente, em todas
  const [filtro, setFiltro] = useState<Filtro>(() =>
    conciliacoes.some((conciliacao) => pedemDecisao(conciliacao) > 0) ? "pendentes" : "todas",
  );
  const visiveis = ordemDeTrabalho(conciliacoes).filter((conciliacao) => passaNoFiltro(conciliacao, filtro));

  return (
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
              {item.rotulo} ({conciliacoes.filter((conciliacao) => passaNoFiltro(conciliacao, item.id)).length})
            </button>
          ))}
        </div>
        {/* as rodadas anteriores e o que já aconteceu ficam no histórico */}
        <Link href="/historico" className="btn btn-secondary conc-historico">
          Ver o histórico
        </Link>
      </FaixaFiltros>

      {visiveis.length === 0 ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <table className="table conc-tabela">
          <colgroup>
            <col />
            <col className="conc-col-mes" />
            <col className="conc-col-rodada" />
            <col className="conc-col-match" />
            <col className="conc-col-decisao" />
            <col className="conc-col-situacao" />
            <col className="conc-col-acao" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Conciliação</th>
              <th scope="col">Mês</th>
              <th scope="col">Rodada</th>
              <th scope="col">Match</th>
              <th scope="col">Pede decisão</th>
              <th scope="col">Situação</th>
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((conciliacao) => (
              <Linha key={conciliacao.extratoBancoId} conciliacao={conciliacao} />
            ))}
          </tbody>
        </table>
      )}
      {parcial && (
        <p className="vg-nota">
          A lista mostra as conciliações das últimas 50 execuções. As anteriores estão no histórico.
        </p>
      )}
    </div>
  );
}

function Linha({ conciliacao }: { conciliacao: ConciliacaoNaLista }) {
  const { extratoBancoId, arquivoBanco, arquivoSistema, competencia, rodada, rodadas, execucao } = conciliacao;
  const pendentes = pedemDecisao(conciliacao);
  const selo = seloDaConciliacao(conciliacao);
  const taxa = taxaDaConciliacao(conciliacao);
  return (
    <tr className="conc-linha" data-pendente={pendentes > 0 || undefined}>
      <td className="conc-c-conciliacao">
        <span className="hist-arquivos">
          <span className="hist-arquivo">
            <IconeOrigem origem="banco" tamanho={14} />
            <span className="hist-arquivo-nome">{arquivoBanco}</span>
          </span>
          <span className="hist-arquivo hist-arquivo-sistema">
            <IconeOrigem origem="sistema" tamanho={13} />
            <span className="hist-arquivo-nome">{arquivoSistema}</span>
          </span>
        </span>
      </td>
      <td className="conc-c-mes">
        <RotuloMovel>Mês</RotuloMovel>
        {mesDaLista(competencia)}
      </td>
      <td className="conc-c-rodada">
        <RotuloMovel>Rodada</RotuloMovel>
        {rodadas > 1 ? `${rodada} de ${rodadas}` : "1"}
      </td>
      <td className="conc-c-match">
        <span className="hist-resultado">
          {execucao.lancamentos > 0 && <BarraDoResultado execucao={execucao} />}
          <span className="hist-taxa">{taxa === null ? "—" : formatarPercentual(taxa)}</span>
        </span>
      </td>
      <td className="conc-c-decisao">
        <RotuloMovel>Pede decisão</RotuloMovel>
        {formatarInteiro(pendentes)}
        {execucao.justificadas > 0 && (
          <span className="hist-justificadas">{` · ${formatarInteiro(execucao.justificadas)} ${execucao.justificadas === 1 ? "justificada" : "justificadas"}`}</span>
        )}
      </td>
      <td className="conc-c-situacao">
        <span className={`selo selo-${selo.tom}`}>{selo.rotulo}</span>
      </td>
      <td className="conc-c-acao">
        {/* pelo endereço só do banco, que abre a rodada que vale */}
        <Link href={caminhoDaConciliacao(extratoBancoId)} className="btn btn-secondary hist-ver">
          {pendentes > 0 ? "Continuar" : "Ver"}
          <span className="sr-only"> {arquivoBanco}</span>
        </Link>
      </td>
    </tr>
  );
}

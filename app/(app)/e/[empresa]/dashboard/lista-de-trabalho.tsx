"use client";

import { useState } from "react";
import Link from "@/lib/link-do-app";
import { ChevronRight } from "lucide-react";
import type { Fechamento } from "@/lib/adaptadores";
import { caminhoDaConciliacao, caminhoDoFechamento } from "@/lib/caminhos";
import { FaixaFiltros } from "../faixa-filtros";
import { IconeOrigem } from "../icone-origem";
import { conciliados } from "../historico/execucoes";
import { BarraDoResultado } from "../historico/por-conciliacao";
import { formatarDataHora, formatarInteiro } from "./resumo";
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
 * A lista de trabalho agrupada por mês (revisão de estilo de 15/10): os meses abertos primeiro e,
 * em cada linha, uma situação só ("9 pedem decisão", "Sem pendência", "Mês fechado"), o progresso e
 * a última atividade. A linha inteira abre a conciliação. Fica no cliente só pelo filtro; as
 * conciliações chegam prontas da página, que roda no servidor.
 */

const FILTROS: { id: FiltroDaLista; rotulo: string; vazio: string }[] = [
  { id: "pendentes", rotulo: "Pedem decisão", vazio: "Nenhuma conciliação pede decisão." },
  { id: "prontas", rotulo: "Sem pendência", vazio: "Toda conciliação de mês aberto ainda pede alguma decisão." },
  { id: "fechadas", rotulo: "Mês fechado", vazio: "Nenhum mês fechado ainda." },
  { id: "todas", rotulo: "Todas", vazio: "Nenhuma conciliação." },
];

function plural(quantidade: number, singular: string, varios: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : varios}`;
}

/** Um rótulo que só aparece na tela estreita, onde a tabela vira um bloco por linha. */
function RotuloMovel({ children }: { children: string }) {
  return (
    <span className="hist-rotulo-movel" aria-hidden="true">
      {children}
    </span>
  );
}

export function ListaDeTrabalho({
  conciliacoes,
  fechamentos,
  parcial,
}: {
  conciliacoes: ConciliacaoNaLista[];
  fechamentos: Fechamento[] | null;
  parcial: boolean;
}) {
  const meses = agruparPorMes(conciliacoes, fechamentos);
  const contar = (filtro: FiltroDaLista) =>
    meses.reduce(
      (soma, mes) => soma + mes.conciliacoes.filter((item) => passaNoFiltro(item, mes.fechamento !== null, filtro)).length,
      0,
    );
  // abre no que pede trabalho; sem nada pendente, em todas
  const [filtro, setFiltro] = useState<FiltroDaLista>(() => (contar("pendentes") > 0 ? "pendentes" : "todas"));
  const visiveis = meses
    .map((mes) => ({ mes, linhas: mes.conciliacoes.filter((item) => passaNoFiltro(item, mes.fechamento !== null, filtro)) }))
    .filter(({ linhas }) => linhas.length > 0);

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

      {visiveis.length === 0 ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <table className="table conc-tabela" data-tutorial="lista">
          <colgroup>
            <col />
            <col className="conc-col-progresso" />
            <col className="conc-col-situacao" />
            <col className="conc-col-atividade" />
            <col className="conc-col-abrir" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Conciliação</th>
              <th scope="col">Progresso</th>
              <th scope="col">Situação</th>
              <th scope="col">Última atividade</th>
              <th scope="col">
                <span className="sr-only">Abrir</span>
              </th>
            </tr>
          </thead>
          {visiveis.map(({ mes, linhas }) => (
            <tbody key={mes.chave}>
              <CabecalhoDoMes mes={mes} />
              {linhas.map((conciliacao) => (
                <Linha key={conciliacao.extratoBancoId} conciliacao={conciliacao} mesFechado={mes.fechamento !== null} />
              ))}
            </tbody>
          ))}
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
  const nomeDoMes = mes.titulo.split(" ")[0].toLowerCase();
  return (
    <tr className="conc-mes">
      <th scope="rowgroup" colSpan={5}>
        <span className="conc-mes-conteudo">
          <span className="conc-mes-titulo">{mes.titulo}</span>
          <span className="conc-mes-meta">{meta}</span>
          <Link href={caminhoDoFechamento(mes.chave)} className="conc-mes-link">
            {fechamento ? "Ver o fechamento" : `Fechamento de ${nomeDoMes}`}
          </Link>
        </span>
      </th>
    </tr>
  );
}

function Linha({ conciliacao, mesFechado }: { conciliacao: ConciliacaoNaLista; mesFechado: boolean }) {
  const { extratoBancoId, arquivoBanco, arquivoSistema, rodada, rodadas, execucao } = conciliacao;
  const pendentes = pedemDecisao(conciliacao);
  const selo = mesFechado ? { rotulo: "Mês fechado", tom: "neutro" } : seloDaConciliacao(conciliacao);
  // pelo endereço só do banco, que abre a rodada que vale
  const caminho = caminhoDaConciliacao(extratoBancoId);
  const progresso = [
    `${formatarInteiro(conciliados(execucao))} de ${formatarInteiro(execucao.lancamentos)} batem`,
    execucao.justificadas > 0 && plural(execucao.justificadas, "justificada", "justificadas"),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <tr className="conc-linha" data-pendente={(!mesFechado && pendentes > 0) || undefined}>
      <td className="conc-c-conciliacao">
        {/* o link cobre a linha inteira (::after), e o leitor de tela lê só o nome */}
        <Link href={caminho} className="conc-abrir">
          <span className="hist-arquivo">
            <IconeOrigem origem="banco" tamanho={14} />
            <span className="hist-arquivo-nome">{arquivoBanco}</span>
          </span>
        </Link>
        <span className="hist-arquivo hist-arquivo-sistema">
          <IconeOrigem origem="sistema" tamanho={13} />
          <span className="hist-arquivo-nome">{`× ${arquivoSistema}`}</span>
        </span>
      </td>
      <td className="conc-c-progresso">
        <RotuloMovel>Progresso</RotuloMovel>
        <span className="conc-progresso">
          {execucao.lancamentos > 0 && <BarraDoResultado execucao={execucao} />}
          <span className="conc-progresso-texto">{progresso}</span>
        </span>
      </td>
      <td className="conc-c-situacao">
        <span className={selo.tom === "neutro" ? "selo" : `selo selo-${selo.tom}`}>{selo.rotulo}</span>
      </td>
      <td className="conc-c-atividade">
        <RotuloMovel>Última atividade</RotuloMovel>
        <span className="conc-atividade">
          <span>{formatarDataHora(execucao.executadaEm)}</span>
          <span className="conc-atividade-rodada">{rodadas > 1 ? `Rodada ${rodada} de ${rodadas}` : `Rodada ${rodada}`}</span>
        </span>
      </td>
      <td className="conc-c-abrir" aria-hidden="true">
        <ChevronRight size={16} />
      </td>
    </tr>
  );
}

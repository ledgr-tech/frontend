"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { Execucao } from "@/lib/adaptadores";
import { salvar } from "../conciliacoes/[id]/exportar-csv";
import { formatarDataHora, formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { IconeOrigem } from "../icone-origem";
import { porMes, segmentos, type Segmento } from "./execucoes";
import { VerExecucao } from "./ver-execucao";

/**
 * A linha do tempo do histórico: as execuções agrupadas pelo mês em que rodaram,
 * cada uma com a barra do que casou e do que pediu revisão. Fica no cliente só
 * pelo filtro; as execuções chegam prontas da página, que roda no servidor.
 */

type Filtro = "todas" | "atuais" | "substituidas";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todas", rotulo: "Todas", vazio: "Nenhuma execução nesta página." },
  { id: "atuais", rotulo: "Atuais", vazio: "Nenhuma execução atual nesta página." },
  { id: "substituidas", rotulo: "Substituídas", vazio: "Nenhuma execução foi refeita nesta página." },
];

function passaNoFiltro(execucao: Execucao, filtro: Filtro): boolean {
  if (filtro === "atuais") return execucao.atual;
  if (filtro === "substituidas") return !execucao.atual;
  return true;
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

const LEGENDA: Segmento[] = [
  { tom: "ok", quantidade: 0, rotulo: "Conciliados" },
  { tom: "risco", quantidade: 0, rotulo: "Custam dinheiro" },
  { tom: "atencao", quantidade: 0, rotulo: "Incompletos" },
  { tom: "neutro", quantidade: 0, rotulo: "Já explicados" },
];

export function LinhaDoTempo({ execucoes }: { execucoes: Execucao[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const meses = porMes(execucoes.filter((execucao) => passaNoFiltro(execucao, filtro)));

  return (
    <section className="hist-linha" aria-labelledby="hist-linha-titulo">
      <div className="vg-secao-topo">
        <h2 id="hist-linha-titulo" className="vg-secao-titulo">
          Execução a execução
        </h2>
        <div className="pills segmentado" role="group" aria-label="Filtrar execuções">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pill"
              aria-pressed={filtro === item.id}
              onClick={() => setFiltro(item.id)}
            >
              {item.rotulo} ({execucoes.filter((execucao) => passaNoFiltro(execucao, item.id)).length})
            </button>
          ))}
        </div>
      </div>

      <ul className="hist-legenda" aria-label="Legenda das barras">
        {LEGENDA.map((item) => (
          <li key={item.tom}>
            <span className="hist-legenda-cor" data-tom={item.tom} aria-hidden="true" />
            {item.rotulo}
          </li>
        ))}
      </ul>

      {meses.length === 0 ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        meses.map((mes) => (
          <div key={mes.chave} className="hist-mes">
            <h3 className="hist-mes-titulo">
              {mes.titulo}
              <span className="hist-mes-conta">{plural(mes.execucoes.length, "execução", "execuções")}</span>
            </h3>
            <ol className="hist-eventos">
              {mes.execucoes.map((execucao) => (
                <Evento key={execucao.id} execucao={execucao} />
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}

function Evento({ execucao }: { execucao: Execucao }) {
  const partes = segmentos(execucao);
  const conciliados = partes.find((parte) => parte.tom === "ok")?.quantidade ?? 0;
  const revisao = execucao.lancamentos - conciliados;

  return (
    <li className="hist-evento" data-atual={execucao.atual}>
      <span className="hist-evento-marca" aria-hidden="true" />
      <div className="hist-evento-corpo">
        <div className="hist-evento-topo">
          <time dateTime={execucao.executadaEm} className="hist-evento-quando">
            {formatarDataHora(execucao.executadaEm)}
          </time>
          {/* o mesmo par de extratos foi conciliado de novo depois: o resultado que
              abre é o da rodada mais nova */}
          <span className={execucao.atual ? "selo selo-ok" : "selo"}>
            {execucao.atual ? "Atual" : "Substituída"}
          </span>
        </div>
        <div className="hist-evento-arquivos">
          <span>
            <IconeOrigem origem="banco" tamanho={14} />
            {execucao.arquivoBanco}
          </span>
          <span>
            <IconeOrigem origem="sistema" tamanho={14} />
            {execucao.arquivoSistema}
          </span>
        </div>
        <span className="hist-evento-numeros">
          {[
            plural(execucao.lancamentos, "lançamento", "lançamentos"),
            execucao.acerto === null ? null : `${formatarPercentual(execucao.acerto)} de match`,
            `tolerância de ${plural(execucao.toleranciaDias, "dia", "dias")}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {execucao.lancamentos > 0 && (
          // a frase ao lado diz o mesmo em texto: a barra é só para o olho
          <span className="hist-evento-barra" aria-hidden="true">
            {partes.map((parte) => (
              <span
                key={parte.tom}
                data-tom={parte.tom}
                style={{ flexGrow: parte.quantidade }}
                title={`${parte.rotulo}: ${formatarInteiro(parte.quantidade)}`}
              />
            ))}
          </span>
        )}
        <div className="hist-evento-rodape">
          <span className="hist-evento-resumo">
            {`${plural(conciliados, "conciliado", "conciliados")} · ${formatarInteiro(revisao)} para revisar`}
          </span>
          <VerExecucao execucao={execucao} />
        </div>
      </div>
    </li>
  );
}

// Arquivo com nome que começa em = + - @ abriria no Excel como fórmula: o
// apóstrofo na frente desliga isso, como o backend faz no CSV da conciliação.
function celula(valor: string): string {
  const seguro = /^[=+\-@\t]/.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

/** O histórico desta página em CSV, no padrão Excel BR: ponto e vírgula, BOM e CRLF. */
export function csvDoHistorico(execucoes: Execucao[]): string {
  const cabecalho = [
    "Executada em",
    "Arquivo do banco",
    "Arquivo do sistema",
    "Lançamentos",
    "Conciliados",
    "Match",
    "Tolerância (dias)",
    "Situação",
  ];
  const linhas = execucoes.map((execucao) => {
    const conciliados = segmentos(execucao).find((parte) => parte.tom === "ok")?.quantidade ?? 0;
    return [
      formatarDataHora(execucao.executadaEm),
      execucao.arquivoBanco,
      execucao.arquivoSistema,
      String(execucao.lancamentos),
      String(conciliados),
      execucao.acerto === null ? "" : execucao.acerto.toFixed(2).replace(".", ","),
      String(execucao.toleranciaDias),
      execucao.atual ? "Atual" : "Substituída",
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
      <Download size={16} aria-hidden="true" />
      Exportar histórico
    </button>
  );
}

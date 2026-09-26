"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Circle, CircleCheck, FileDown } from "lucide-react";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { Tom } from "@/lib/mock-data";
import { ExportarCsv } from "../conciliacoes/[id]/exportar-csv";
import { formatarDataHora, formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import type { MesDeFechamento } from "./fechamento";

/**
 * A mesa de fechamento: cada mês é uma folha, e o selecionado abre ao lado o
 * que falta para fechá-lo — o mesmo desenho da galeria de extratos. Fica no
 * cliente só pelo filtro e pela seleção; os meses chegam prontos do servidor.
 */

type Filtro = "todos" | "prontos" | "pendentes";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todos", rotulo: "Todos", vazio: "Nenhum mês." },
  { id: "prontos", rotulo: "Prontos para fechar", vazio: "Nenhum mês pronto para fechar ainda." },
  { id: "pendentes", rotulo: "Com pendência", vazio: "Nenhum mês com pendência." },
];

function passaNoFiltro(mes: MesDeFechamento, filtro: Filtro): boolean {
  if (filtro === "prontos") return mes.pronto;
  if (filtro === "pendentes") return !mes.pronto;
  return true;
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

function taxa(mes: MesDeFechamento): number {
  return mes.lancamentos === 0 ? 0 : (mes.conciliados / mes.lancamentos) * 100;
}

function seloDoMes(mes: MesDeFechamento): { rotulo: string; tom: Tom } {
  if (mes.pronto) return { rotulo: "Pronto para fechar", tom: "ok" };
  // sem divergência, o que segura o mês são as linhas que o parser não leu
  if (mes.divergentes === 0) return { rotulo: "Linhas não lidas", tom: "atencao" };
  return {
    rotulo: plural(mes.divergentes, "pendência", "pendências"),
    tom: mes.pendencias[0].tom === "risco" ? "risco" : "atencao",
  };
}

export function MesaDeFechamento({ meses }: { meses: MesDeFechamento[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionado, setSelecionado] = useState<string | null>(meses[0]?.chave ?? null);

  const visiveis = meses.filter((mes) => passaNoFiltro(mes, filtro));
  // se o filtro esconder o selecionado, o painel passa ao primeiro visível
  const aberto = visiveis.find((mes) => mes.chave === selecionado) ?? visiveis[0] ?? null;

  return (
    <div className="extratos-corpo">
      <div className="pills segmentado" role="group" aria-label="Filtrar meses">
        {FILTROS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="pill"
            aria-pressed={filtro === item.id}
            onClick={() => setFiltro(item.id)}
          >
            {item.rotulo} ({meses.filter((mes) => passaNoFiltro(mes, item.id)).length})
          </button>
        ))}
      </div>

      {aberto === null ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <div className="extratos-area">
          <div className="extratos-grade">
            {visiveis.map((mes) => {
              const selo = seloDoMes(mes);
              return (
                <button
                  key={mes.chave}
                  type="button"
                  className="extrato-cartao"
                  // hover e seleção na cor do selo, como na galeria de extratos
                  data-tom={selo.tom}
                  aria-pressed={mes.chave === aberto.chave}
                  onClick={() => setSelecionado(mes.chave)}
                >
                  <FolhaDoMes mes={mes} />
                  <span className="extrato-nome">{mes.titulo}</span>
                  <span className="extrato-meta">
                    {`${formatarInteiro(mes.conciliados)} de ${plural(mes.lancamentos, "lançamento", "lançamentos")}`}
                  </span>
                  <span className={`selo selo-${selo.tom}`}>{selo.rotulo}</span>
                </button>
              );
            })}
          </div>
          <Painel mes={aberto} />
        </div>
      )}
    </div>
  );
}

/** A folha do mês, como uma página de calendário: o mês, o ano e quanto já bateu. */
function FolhaDoMes({ mes }: { mes: MesDeFechamento }) {
  return (
    <span className="extrato-folha mes-folha" data-pronto={mes.pronto || undefined} aria-hidden="true">
      <span className="extrato-folha-titulo">Competência</span>
      <span className="mes-folha-nome">{mes.nome}</span>
      <span className="mes-folha-ano">{mes.ano}</span>
      <span className="mes-folha-taxa">{formatarPercentual(taxa(mes))}</span>
      <span className="mes-folha-rotulo">conciliado</span>
      <span className="vg-progresso">
        <span className="vg-progresso-feito" style={{ width: `${taxa(mes)}%` }} />
      </span>
    </span>
  );
}

function Passo({ feito, icone, titulo, children }: { feito?: boolean; icone?: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <li className="fech-passo" data-feito={feito}>
      <span className="fech-passo-icone" aria-hidden="true">
        {icone ?? (feito ? <CircleCheck size={18} /> : <Circle size={18} />)}
      </span>
      <div className="fech-passo-corpo">
        <span className="fech-passo-titulo">
          {titulo}
          {feito !== undefined && <span className="sr-only">{feito ? " (feito)" : " (pendente)"}</span>}
        </span>
        {children}
      </div>
    </li>
  );
}

function Painel({ mes }: { mes: MesDeFechamento }) {
  const conciliadas = mes.pares.map((par) => ({
    ...par,
    caminho: caminhoDaConciliacao(par.execucao.extratoBancoId, par.execucao.extratoSistemaId),
  }));
  // "Revisar" abre a primeira conciliação do mês que ainda tem divergência
  const comPendencia =
    conciliadas.find((par) => Object.keys(par.execucao.divergencias).length > 0) ?? conciliadas[0];
  const ultima = mes.pares[0].execucao.executadaEm;

  return (
    <section className="extrato-painel" aria-label="Mês selecionado">
      <h6 style={{ margin: 0 }}>Fechamento · {mes.pronto ? "pronto para fechar" : "em aberto"}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{mes.titulo}</h3>
        {mes.pronto && (
          <Image
            src="/mascotes/mascote-comemorando.png"
            alt=""
            width={1000}
            height={1000}
            sizes="56px"
            style={{ width: 56, height: "auto", flex: "none" }}
          />
        )}
      </div>

      <div className="fech-progresso">
        <span className="vg-nota">
          {`${formatarInteiro(mes.conciliados)} de ${plural(mes.lancamentos, "lançamento conciliado", "lançamentos conciliados")}`}
        </span>
        <div
          className="vg-progresso"
          role="progressbar"
          aria-label="Lançamentos conciliados"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(taxa(mes))}
          aria-valuetext={`${formatarPercentual(taxa(mes))} conciliado`}
        >
          <span className="vg-progresso-feito" style={{ width: `${taxa(mes)}%` }} />
        </div>
      </div>

      <ol className="fech-passos" aria-label="Para fechar o mês">
        <Passo feito titulo="Extratos conciliados">
          <ul className="fech-passo-lista">
            {conciliadas.map((par) => (
              <li key={par.execucao.id}>
                <Link href={par.caminho} className="fech-link">
                  {`${par.execucao.arquivoBanco} × ${par.execucao.arquivoSistema}`}
                </Link>
              </li>
            ))}
          </ul>
        </Passo>

        <Passo feito={mes.divergentes === 0} titulo="Divergências decididas">
          {mes.divergentes === 0 ? (
            <span className="fech-passo-texto">Nenhuma divergência pede decisão.</span>
          ) : (
            <>
              <ul className="fech-passo-lista">
                {mes.pendencias.map((pendencia) => (
                  <li key={pendencia.status} className="fech-pendencia">
                    <span className={`vg-ponto vg-ponto-${pendencia.tom}`} aria-hidden="true" />
                    <span>{pendencia.rotulo}</span>
                    <span className="fech-pendencia-quantidade">{formatarInteiro(pendencia.quantidade)}</span>
                  </li>
                ))}
              </ul>
              <Link href={comPendencia.caminho} className="fech-link">
                Revisar na conciliação
              </Link>
            </>
          )}
        </Passo>

        <Passo feito={mes.naoLidas.length === 0} titulo="Arquivos lidos por inteiro">
          {mes.naoLidas.length === 0 ? (
            <span className="fech-passo-texto">O parser leu todas as linhas dos arquivos.</span>
          ) : (
            <>
              <ul className="fech-passo-lista">
                {mes.naoLidas.map((arquivo) => (
                  <li key={arquivo.nome} className="fech-passo-texto">
                    {`${plural(arquivo.linhas, "linha não lida", "linhas não lidas")} em ${arquivo.nome}`}
                  </li>
                ))}
              </ul>
              <Link href="/extratos" className="fech-link">
                Ver nos extratos
              </Link>
            </>
          )}
        </Passo>

        {/* não é condição para fechar: é o que se entrega depois, por isso não tem marca */}
        <Passo icone={<FileDown size={18} />} titulo="Relatório para o contador">
          {conciliadas.map((par) => (
            <div key={par.execucao.id} className="fech-relatorio">
              {conciliadas.length > 1 && <span className="fech-passo-texto">{par.execucao.arquivoBanco}</span>}
              <ExportarCsv
                extratoBancoId={par.execucao.extratoBancoId}
                extratoSistemaId={par.execucao.extratoSistemaId}
                mes={`${mes.nome}/${mes.ano}`}
                filtrada={false}
              />
            </div>
          ))}
        </Passo>
      </ol>

      {mes.pronto ? (
        <Link href="/conciliacoes/nova" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          {`Começar ${mes.proximo}`}
        </Link>
      ) : mes.divergentes > 0 ? (
        <Link href={comPendencia.caminho} className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Revisar pendências
        </Link>
      ) : (
        <Link href="/extratos" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
          Ver extratos
        </Link>
      )}

      {/* ponytail: o backend não registra o encerramento do mês. Quando registrar,
          é aqui que entram o "encerrado em" e o botão de fechar. */}
      <p className="vg-nota" style={{ margin: 0, fontSize: 13 }}>
        {`Última conciliação em ${formatarDataHora(ultima)}. O Ledgr ainda não registra o encerramento: o mês fica pronto quando nada pede decisão.`}
      </p>
    </section>
  );
}

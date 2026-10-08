"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Circle, CircleCheck, FileDown } from "lucide-react";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { Tom } from "@/lib/mock-data";
import { fecharMes, reabrirMes, type Resultado } from "../conciliacoes/acoes";
import { ExportarCsv } from "../conciliacoes/[id]/exportar-csv";
import { formatarDataHora, formatarInteiro, formatarPercentual } from "../dashboard/resumo";
import { FaixaFiltros } from "../faixa-filtros";
import { Grupo, alternarNoConjunto } from "../grupo";
import type { MesDeFechamento } from "./fechamento";

/**
 * A mesa de fechamento: cada mês é uma folha, e o selecionado abre ao lado o
 * que falta para fechá-lo e o fechamento em si — o mesmo desenho da galeria de
 * extratos. Fica no cliente pelo filtro, pela seleção e por fechar e reabrir,
 * que leem a tela de novo; os meses chegam prontos do servidor.
 */

type Filtro = "todos" | "prontos" | "pendentes" | "fechados";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todos", rotulo: "Todos", vazio: "Nenhum mês." },
  { id: "prontos", rotulo: "Prontos para fechar", vazio: "Nenhum mês pronto para fechar ainda." },
  { id: "pendentes", rotulo: "Com pendência", vazio: "Nenhum mês com pendência." },
  { id: "fechados", rotulo: "Fechados", vazio: "Nenhum mês fechado ainda." },
];

/** Fechado agora: o registro mais recente do mês não foi reaberto. */
function estaFechado(mes: MesDeFechamento): boolean {
  return mes.fechamento?.estado === "fechado";
}

/** Nada mais a fazer no mês: fechado, ou pronto para fechar. É o que recolhe nos anos passados. */
function resolvido(mes: MesDeFechamento): boolean {
  return estaFechado(mes) || mes.pronto;
}

function passaNoFiltro(mes: MesDeFechamento, filtro: Filtro): boolean {
  if (filtro === "prontos") return mes.pronto && !estaFechado(mes);
  if (filtro === "pendentes") return !mes.pronto && !estaFechado(mes);
  if (filtro === "fechados") return estaFechado(mes);
  return true;
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

function taxa(mes: MesDeFechamento): number {
  return mes.lancamentos === 0 ? 0 : (mes.conciliados / mes.lancamentos) * 100;
}

/** As divergências que ainda pedem decisão: as justificadas já foram decididas. */
function pendentes(mes: MesDeFechamento): number {
  return mes.divergentes - mes.justificadas;
}

function seloDoMes(mes: MesDeFechamento): { rotulo: string; tom: Tom } {
  if (estaFechado(mes)) {
    return mes.fechamento?.ressalva ? { rotulo: "Fechado com ressalva", tom: "atencao" } : { rotulo: "Fechado", tom: "ok" };
  }
  if (mes.pronto) return { rotulo: "Pronto para fechar", tom: "ok" };
  // sem divergência por decidir, o que segura o mês são as linhas que o parser não leu
  if (pendentes(mes) === 0) return { rotulo: "Linhas não lidas", tom: "atencao" };
  return {
    rotulo: plural(pendentes(mes), "pendência", "pendências"),
    tom: mes.pendencias[0].tom === "risco" ? "risco" : "atencao",
  };
}

type Ano = { ano: string; meses: MesDeFechamento[] };

/** Os meses já vêm do mais recente para o mais antigo: cada troca de ano abre um grupo. */
function agruparPorAno(meses: MesDeFechamento[]): Ano[] {
  const anos: Ano[] = [];
  for (const mes of meses) {
    const ultimo = anos.at(-1);
    if (ultimo?.ano === mes.ano) ultimo.meses.push(mes);
    else anos.push({ ano: mes.ano, meses: [mes] });
  }
  return anos;
}

function resumoDoAno(meses: MesDeFechamento[]): string {
  const pendentes = meses.filter((mes) => !resolvido(mes)).length;
  const situacao =
    pendentes > 0 ? `${formatarInteiro(pendentes)} com pendência` : meses.length === 1 ? "pronta" : "todas prontas";
  return `${plural(meses.length, "competência", "competências")} · ${situacao}`;
}

export function MesaDeFechamento({
  meses,
  inicial,
  podeFechar,
}: {
  meses: MesDeFechamento[];
  /** A competência (AAAA-MM) que abre no painel; sem ela, ou sem esse mês, a mais recente. */
  inicial?: string;
  /** Falso quando os fechamentos não carregaram: sem saber o que está fechado, a mesa só mostra. */
  podeFechar: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionado, setSelecionado] = useState<string | null>(
    () => meses.find((mes) => mes.chave === inicial)?.chave ?? meses[0]?.chave ?? null,
  );
  // os anos passados que a pessoa abriu para ver também os meses prontos
  const [prontosAbertos, setProntosAbertos] = useState<ReadonlySet<string>>(new Set());
  // os anos recolhidos inteiros pelo título, para chegar ao seguinte sem rolar por eles
  const [anosFechados, setAnosFechados] = useState<ReadonlySet<string>>(new Set());

  const visiveis = meses.filter((mes) => passaNoFiltro(mes, filtro));
  // se o filtro esconder o selecionado, o painel passa ao primeiro visível
  const aberto = visiveis.find((mes) => mes.chave === selecionado) ?? visiveis[0] ?? null;

  // Com mais de um ano, cada ano vira um bloco com título, que recolhe o ano inteiro. Do ano corrente
  // aparecem todos os meses; dos anteriores, só o que ainda pede decisão, e os prontos abrem no botão.
  // Num ano só, a grade segue sem título, como sempre foi. No filtro de prontos nada recolhe: é o
  // que se pediu para ver.
  const anos = agruparPorAno(visiveis);
  const comTitulo = anos.length > 1;
  const anoCorrente = meses[0]?.ano;

  return (
    <div className="extratos-corpo">
      {/* a faixa dos filtros fica presa sob a barra do topo enquanto os meses rolam */}
      <FaixaFiltros>
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
      </FaixaFiltros>

      {aberto === null ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <div className="extratos-area fech-area">
          <div className="grupos">
            {anos.map(({ ano, meses: doAno }) => {
              const recolhivel = comTitulo && filtro === "todos" && ano !== anoCorrente;
              const expandido = !recolhivel || prontosAbertos.has(ano);
              // o mês aberto no painel fica à vista mesmo resolvido, para a folha não sumir debaixo dele
              const mostrados = expandido ? doAno : doAno.filter((mes) => !resolvido(mes) || mes.chave === aberto.chave);
              const ocultos = doAno.length - mostrados.length;
              const temProntos = doAno.some(resolvido);
              const id = `fech-ano-${ano}`;
              const conteudo = (
                <>
                  <div id={`${id}-meses`} className="extratos-grade" hidden={mostrados.length === 0}>
                    {mostrados.map((mes) => {
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
                  {recolhivel && (expandido ? temProntos : ocultos > 0) && (
                    <button
                      type="button"
                      className="btn btn-ghost grupo-alternar"
                      aria-expanded={expandido}
                      aria-controls={`${id}-meses`}
                      onClick={() => setProntosAbertos(alternarNoConjunto(ano))}
                    >
                      {expandido
                        ? doAno.filter(resolvido).length === 1
                          ? "Esconder o mês pronto"
                          : "Esconder os meses prontos"
                        : ocultos === 1
                          ? "Mostrar o mês pronto"
                          : `Mostrar os ${formatarInteiro(ocultos)} meses prontos`}
                    </button>
                  )}
                </>
              );
              return comTitulo ? (
                <Grupo
                  key={ano}
                  id={id}
                  titulo={ano}
                  resumo={resumoDoAno(doAno)}
                  fechado={anosFechados.has(ano)}
                  onAlternar={() => setAnosFechados(alternarNoConjunto(ano))}
                >
                  {conteudo}
                </Grupo>
              ) : (
                <div key={ano} className="grupo-corpo">
                  {conteudo}
                </div>
              );
            })}
          </div>
          <Painel mes={aberto} podeFechar={podeFechar} />
        </div>
      )}
    </div>
  );
}

/** A folha do mês, como uma página de calendário: o mês, o ano e quanto já bateu. */
function FolhaDoMes({ mes }: { mes: MesDeFechamento }) {
  return (
    <span className="extrato-folha mes-folha" data-pronto={resolvido(mes) || undefined} aria-hidden="true">
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

function Painel({ mes, podeFechar }: { mes: MesDeFechamento; podeFechar: boolean }) {
  const conciliadas = mes.pares.map((par) => ({
    ...par,
    caminho: caminhoDaConciliacao(par.execucao.extratoBancoId, par.execucao.extratoSistemaId),
  }));
  // "Revisar" abre a primeira conciliação do mês que ainda tem divergência
  const comPendencia =
    conciliadas.find((par) => Object.keys(par.execucao.divergencias).length > 0) ?? conciliadas[0];
  const ultima = mes.pares[0].execucao.executadaEm;
  const fechado = estaFechado(mes) ? mes.fechamento : null;

  return (
    <section className="extrato-painel fech-painel" aria-label="Mês selecionado">
      <h6 style={{ margin: 0 }}>Fechamento · {fechado ? "fechado" : mes.pronto ? "pronto para fechar" : "em aberto"}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{mes.titulo}</h3>
        {resolvido(mes) && (
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

      {fechado && (
        <div className="fech-encerrado">
          <p className="fech-passo-texto" style={{ margin: 0 }}>
            {`Fechado em ${formatarDataHora(fechado.fechadoEm)} por ${fechado.fechadoPor}.`}
          </p>
          {fechado.ressalva && (
            <blockquote className="fech-ressalva">
              <span className="fech-ressalva-rotulo">Ressalva</span>
              <span>{fechado.ressalva}</span>
            </blockquote>
          )}
        </div>
      )}
      {/* reaberto: foi fechado e alguém abriu de novo; fechar outra vez cria outro registro */}
      {mes.fechamento?.estado === "reaberto" && mes.fechamento.reabertoEm && (
        <p className="fech-passo-texto" style={{ margin: 0 }}>
          {`Reaberto em ${formatarDataHora(mes.fechamento.reabertoEm)} por ${mes.fechamento.reabertoPor}.`}
        </p>
      )}

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

        <Passo feito={pendentes(mes) === 0} titulo="Divergências decididas">
          {pendentes(mes) === 0 ? (
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

        {/* as justificadas, à parte: decididas, mas não batidas (spec 2026-10-02-conciliacao-em-rodadas) */}
        {mes.justificadas > 0 && (
          <Passo feito titulo={plural(mes.justificadas, "divergência justificada", "divergências justificadas")}>
            <span className="fech-passo-texto">O motivo de cada uma fica no registro da conciliação.</span>
          </Passo>
        )}

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

      {podeFechar ? (
        <AcoesDoFechamento mes={mes} revisar={comPendencia.caminho} />
      ) : (
        // sem a lista de fechamentos, o caminho de antes: começar o próximo, revisar ou ver os extratos
        <div className="fech-acoes">
          {mes.pronto ? (
            <Link href="/conciliacoes/nova" className="btn btn-primary">
              {`Começar ${mes.proximo}`}
            </Link>
          ) : (
            <Link href={pendentes(mes) > 0 ? comPendencia.caminho : "/extratos"} className="btn btn-primary">
              {pendentes(mes) > 0 ? "Revisar pendências" : "Ver extratos"}
            </Link>
          )}
        </div>
      )}

      <p className="vg-nota" style={{ margin: 0, fontSize: 13 }}>
        {`Última conciliação em ${formatarDataHora(ultima)}.`}
      </p>
    </section>
  );
}

/**
 * Fechar e reabrir o mês (backend #86). Pronto, o botão principal fecha; com pendência, o
 * principal continua sendo revisar, e "Fechar mesmo assim" pergunta ao backend o que falta: o 409
 * vem com o texto, e a tela pede a ressalva para fechar com ela. Fechado, o mês leva ao próximo e
 * pode ser reaberto. Depois de cada um, a tela é lida de novo.
 */
function AcoesDoFechamento({ mes, revisar }: { mes: MesDeFechamento; revisar: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // o backend recusou por pendência (409): a ressalva é o que falta para fechar
  const [pedeRessalva, setPedeRessalva] = useState(false);
  const [ressalva, setRessalva] = useState("");
  const mesSozinho = mes.nome.toLowerCase();

  async function executar(acao: () => Promise<Resultado<unknown>>) {
    setEnviando(true);
    setErro(null);
    let resposta: Resultado<unknown>;
    try {
      resposta = await acao();
    } catch {
      // a Server Action lançou (rede caída, deploy novo no meio) em vez de devolver um Resultado
      resposta = { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
    }
    setEnviando(false);
    if (resposta.ok) {
      setPedeRessalva(false);
      setRessalva("");
      router.refresh();
      return;
    }
    if (resposta.status === 401) router.push("/login");
    setErro(resposta.erro);
    if (resposta.status === 409) {
      setPedeRessalva(true);
      // se o 409 for de um mês que outra aba já fechou, a tela relida o mostra fechado
      router.refresh();
    }
  }

  if (estaFechado(mes)) {
    return (
      <div className="fech-acoes">
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          {`Começar ${mes.proximo}`}
        </Link>
        <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => executar(() => reabrirMes(mes.chave))}>
          {`Reabrir ${mesSozinho}`}
        </button>
        {erro && (
          <p role="alert" className="selo selo-risco fech-erro">
            {erro}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fech-acoes">
      {mes.pronto ? (
        <button type="button" className="btn btn-primary" disabled={enviando} onClick={() => executar(() => fecharMes(mes.chave))}>
          {`Fechar ${mesSozinho}`}
        </button>
      ) : (
        <>
          <Link href={pendentes(mes) > 0 ? revisar : "/extratos"} className="btn btn-primary">
            {pendentes(mes) > 0 ? "Revisar pendências" : "Ver extratos"}
          </Link>
          {!pedeRessalva && (
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => executar(() => fecharMes(mes.chave))}>
              Fechar mesmo assim
            </button>
          )}
        </>
      )}
      {erro && (
        <p role="alert" className="selo selo-risco fech-erro">
          {erro}
        </p>
      )}
      {pedeRessalva && (
        <form
          className="fech-ressalva-form"
          onSubmit={(evento) => {
            evento.preventDefault();
            void executar(() => fecharMes(mes.chave, ressalva));
          }}
        >
          <label className="fech-campo">
            <span>Ressalva</span>
            <textarea
              className="input"
              rows={3}
              maxLength={1000}
              value={ressalva}
              onChange={(evento) => setRessalva(evento.target.value)}
            />
          </label>
          <span className="vg-nota">Fica registrada no fechamento, com o seu nome e o horário.</span>
          <div className="fech-acoes">
            <button type="submit" className="btn btn-primary" disabled={enviando || ressalva.trim() === ""}>
              Fechar com ressalva
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPedeRessalva(false);
                setErro(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

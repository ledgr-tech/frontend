"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Tom } from "@/lib/mock-data";
import type { ArquivoExtrato } from "../conciliacoes/acoes";
import { formatarDataHora, formatarInteiro } from "../dashboard/resumo";
import { tituloDaCompetencia } from "../fechamentos/fechamento";
import { FaixaFiltros } from "../faixa-filtros";
import { Grupo, alternarNoConjunto } from "../grupo";
import { IconeOrigem } from "../icone-origem";
import { agrupamentoSalvo, salvarAgrupamento, type Agrupamento } from "./agrupamento";

/**
 * A galeria de "Extratos carregados" do design: cada arquivo é uma folha, e o
 * selecionado abre no painel ao lado. Fica no cliente só pelo filtro e pela
 * seleção — os dados chegam prontos da página, que roda no servidor.
 *
 * Do painel do design ficaram de fora caminho, tamanho, hash, "enviado por",
 * "Abrir o arquivo" e "Copiar caminho": o backend não guarda nada disso.
 */

type Filtro = "todos" | "banco" | "sistema" | "problema";

const FILTROS: { id: Filtro; rotulo: string; vazio: string }[] = [
  { id: "todos", rotulo: "Todos", vazio: "Nenhum arquivo." },
  { id: "banco", rotulo: "Do banco", vazio: "Nenhum arquivo do banco." },
  { id: "sistema", rotulo: "Do sistema", vazio: "Nenhum arquivo do sistema." },
  { id: "problema", rotulo: "Com problema", vazio: "Nenhum arquivo com problema." },
];


const AGRUPAMENTOS: { id: Agrupamento; rotulo: string }[] = [
  { id: "mes", rotulo: "Mês" },
  { id: "ano", rotulo: "Ano" },
  { id: "nenhum", rotulo: "Nenhum" },
];

type GrupoDeArquivos = { chave: string; titulo: string; arquivos: ArquivoExtrato[] };

/** O grupo de quem ainda não tem período: enviado e não lido, ou sem lançamento válido. */
const SEM_PERIODO = "sem-periodo";

/**
 * Os arquivos por competência (o mês em que o extrato começa, o mesmo do fechamento) ou por ano
 * dela, do mais recente para o mais antigo, e no fim os que ainda não têm período. Dentro do grupo
 * seguem na ordem em que chegam: o enviado por último antes.
 */
function agrupar(arquivos: ArquivoExtrato[], como: "mes" | "ano"): GrupoDeArquivos[] {
  const grupos = new Map<string, ArquivoExtrato[]>();
  for (const arquivo of arquivos) {
    const chave = arquivo.competencia === null ? SEM_PERIODO : como === "mes" ? arquivo.competencia : arquivo.competencia.slice(0, 4);
    grupos.set(chave, [...(grupos.get(chave) ?? []), arquivo]);
  }
  return [...grupos]
    .sort(([a], [b]) => (a === SEM_PERIODO ? 1 : b === SEM_PERIODO ? -1 : b.localeCompare(a)))
    .map(([chave, doGrupo]) => ({
      chave,
      titulo: chave === SEM_PERIODO ? "Sem período" : como === "mes" ? tituloDaCompetencia(chave) : chave,
      arquivos: doGrupo,
    }));
}

function resumoDoGrupo(arquivos: ArquivoExtrato[]): string {
  const problemas = arquivos.filter(temProblema).length;
  const total = `${formatarInteiro(arquivos.length)} ${arquivos.length === 1 ? "arquivo" : "arquivos"}`;
  return problemas > 0 ? `${total} · ${formatarInteiro(problemas)} com problema` : total;
}

const ORIGEM = { banco: "Extrato do banco", sistema: "Extrato do sistema de gestão" };

/** Linhas da folha desenhada: a largura varia por arquivo, sem sortear a cada render. */
const LINHAS_DA_FOLHA = 9;

function temProblema(arquivo: ArquivoExtrato): boolean {
  return arquivo.situacao === "erro" || arquivo.situacao === "concluido_com_erros" || arquivo.naoLidas > 0;
}

function passaNoFiltro(arquivo: ArquivoExtrato, filtro: Filtro): boolean {
  if (filtro === "banco" || filtro === "sistema") return arquivo.origem === filtro;
  if (filtro === "problema") return temProblema(arquivo);
  return true;
}

/** A versão do extrato do sistema que uma mais nova substituiu na mesma conciliação. */
function versaoAnterior(arquivo: ArquivoExtrato): number | null {
  return arquivo.rodada && arquivo.rodada.numero < arquivo.rodada.total ? arquivo.rodada.numero : null;
}

function situacao(arquivo: ArquivoExtrato): { rotulo: string; tom: Tom } {
  switch (arquivo.situacao) {
    case "concluido": {
      // lido, e ainda fora de qualquer conciliação
      if (!arquivo.conciliado) return { rotulo: "Não conciliado", tom: "neutro" };
      // entrou numa rodada que já não vale: foi conciliado, mas não é ele que conta
      const anterior = versaoAnterior(arquivo);
      return anterior === null
        ? { rotulo: "Conciliado", tom: "ok" }
        : { rotulo: `Versão anterior · rodada ${anterior}`, tom: "neutro" };
    }
    case "concluido_com_erros":
      return { rotulo: "Com linhas não lidas", tom: "atencao" };
    case "erro":
      return { rotulo: "Rejeitado", tom: "risco" };
    case "pendente":
    case "processando":
      return { rotulo: "Processando", tom: "neutro" };
  }
}

function extensao(nome: string): string {
  const partes = nome.split(".");
  return partes.length > 1 ? partes[partes.length - 1].toUpperCase().slice(0, 4) : "ARQ";
}

function conteudo(arquivo: ArquivoExtrato): string {
  if (arquivo.lancamentos === null) return "Conteúdo indisponível";
  return `${formatarInteiro(arquivo.lancamentos)} ${arquivo.lancamentos === 1 ? "lançamento" : "lançamentos"}`;
}

function semente(id: string): number {
  let soma = 0;
  for (const letra of id) soma = (soma * 31 + letra.charCodeAt(0)) % 997;
  return soma;
}

function Folha({ arquivo }: { arquivo: ArquivoExtrato }) {
  const base = semente(arquivo.id);
  const problema = temProblema(arquivo);
  return (
    <span className="extrato-folha" data-origem={arquivo.origem} aria-hidden="true">
      <span className="extrato-folha-titulo">{ORIGEM[arquivo.origem]}</span>
      <span className="extrato-folha-linhas">
        {Array.from({ length: LINHAS_DA_FOLHA }, (_, i) => (
          <span
            key={i}
            className="extrato-folha-linha"
            // as linhas douradas marcam o arquivo que tem linha não lida, como no design
            data-marcada={problema && (i === 3 || i === 6) ? "true" : undefined}
          >
            <span style={{ maxWidth: `${34 + ((base + i * 13) % 44)}%` }} />
            <span />
          </span>
        ))}
      </span>
      <span className="extrato-etiqueta" data-problema={problema ? "true" : undefined}>
        {extensao(arquivo.nome)}
      </span>
    </span>
  );
}

export function Galeria({ arquivos }: { arquivos: ArquivoExtrato[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selecionado, setSelecionado] = useState<string | null>(arquivos[0]?.id ?? null);
  // por mês de saída (com dezenas de arquivos, a grade solta virava uma parede de folhas), até ler a
  // escolha salva: ela só existe no navegador, e lida já no primeiro render o HTML do servidor divergiria
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("mes");
  // os grupos recolhidos pelo título, pela chave (AAAA-MM ou AAAA), que não se repete entre os modos
  const [fechados, setFechados] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgrupamento(agrupamentoSalvo());
  }, []);

  function escolherAgrupamento(proximo: Agrupamento) {
    salvarAgrupamento(proximo);
    setAgrupamento(proximo);
  }

  const visiveis = arquivos.filter((arquivo) => passaNoFiltro(arquivo, filtro));
  // se o filtro esconder o selecionado, o painel passa ao primeiro visível
  const aberto = visiveis.find((arquivo) => arquivo.id === selecionado) ?? visiveis[0] ?? null;

  const grade = (doGrupo: ArquivoExtrato[], selecionadoId: string) => (
    <div className="extratos-grade">
      {doGrupo.map((arquivo) => {
        const selo = situacao(arquivo);
        return (
          <button
            key={arquivo.id}
            type="button"
            className="extrato-cartao"
            // hover e seleção na cor da situação do arquivo, como o selo
            data-tom={selo.tom}
            aria-pressed={arquivo.id === selecionadoId}
            onClick={() => setSelecionado(arquivo.id)}
          >
            <Folha arquivo={arquivo} />
            <span className="extrato-nome">
              <IconeOrigem origem={arquivo.origem} tamanho={15} />
              {arquivo.nome}
            </span>
            <span className="extrato-meta">{conteudo(arquivo)}</span>
            <span className={selo.tom === "neutro" ? "selo" : `selo selo-${selo.tom}`}>{selo.rotulo}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="extratos-corpo">
      {/* a faixa fica presa sob a barra do topo enquanto as folhas rolam */}
      <FaixaFiltros>
        <div className="pills segmentado" role="group" aria-label="Filtrar arquivos">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="pill"
              aria-pressed={filtro === item.id}
              onClick={() => setFiltro(item.id)}
            >
              {item.rotulo} ({arquivos.filter((arquivo) => passaNoFiltro(arquivo, item.id)).length})
            </button>
          ))}
        </div>
        <div className="extratos-agrupar">
          <span id="extratos-agrupar-rotulo" className="extratos-agrupar-rotulo">
            Agrupar por
          </span>
          <div className="pills segmentado" role="group" aria-labelledby="extratos-agrupar-rotulo">
            {AGRUPAMENTOS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="pill"
                aria-pressed={agrupamento === item.id}
                onClick={() => escolherAgrupamento(item.id)}
              >
                {item.rotulo}
              </button>
            ))}
          </div>
        </div>
      </FaixaFiltros>

      {aberto === null ? (
        <p className="extratos-vazio">{FILTROS.find((item) => item.id === filtro)?.vazio}</p>
      ) : (
        <div className="extratos-area">
          {agrupamento === "nenhum" ? (
            grade(visiveis, aberto.id)
          ) : (
            <div className="grupos">
              {agrupar(visiveis, agrupamento).map((grupo) => (
                <Grupo
                  key={grupo.chave}
                  id={`extratos-${grupo.chave}`}
                  titulo={grupo.titulo}
                  resumo={resumoDoGrupo(grupo.arquivos)}
                  fechado={fechados.has(grupo.chave)}
                  onAlternar={() => setFechados(alternarNoConjunto(grupo.chave))}
                >
                  {grade(grupo.arquivos, aberto.id)}
                </Grupo>
              ))}
            </div>
          )}
          <Painel arquivo={aberto} />
        </div>
      )}
    </div>
  );
}

function Painel({ arquivo }: { arquivo: ArquivoExtrato }) {
  const selo = situacao(arquivo);
  const { naoLidas } = arquivo;
  return (
    <section className="extrato-painel" aria-label="Arquivo selecionado">
      <h6 style={{ margin: 0 }}>Arquivo · {selo.rotulo.toLowerCase()}</h6>
      <div className="extrato-painel-topo">
        <h3 className="extrato-painel-nome">{arquivo.nome}</h3>
        <IconeOrigem origem={arquivo.origem} tamanho={22} />
      </div>

      <dl className="extrato-campos">
        <div>
          <dt>Origem</dt>
          <dd>{ORIGEM[arquivo.origem]}</dd>
        </div>
        <div>
          <dt>Conteúdo</dt>
          <dd>{conteudo(arquivo)}</dd>
        </div>
        <div>
          <dt>Enviado em</dt>
          <dd>{formatarDataHora(arquivo.enviadoEm)}</dd>
        </div>
        {arquivo.conciliadoEm && (
          <div>
            <dt>Última conciliação</dt>
            <dd>{formatarDataHora(arquivo.conciliadoEm)}</dd>
          </div>
        )}
        {arquivo.rodada && arquivo.rodada.total > 1 && (
          <div>
            <dt>Rodada</dt>
            <dd>{`${arquivo.rodada.numero} de ${arquivo.rodada.total}`}</dd>
          </div>
        )}
        <div>
          <dt>Identificador</dt>
          <dd style={{ wordBreak: "break-all" }}>{arquivo.id}</dd>
        </div>
      </dl>

      {naoLidas > 0 && (
        <div className="extrato-nao-lidas">
          <h4>
            {formatarInteiro(naoLidas)} {naoLidas === 1 ? "linha não lida" : "linhas não lidas"}
          </h4>
          {/* o motivo de cada uma vem do detalhe do arquivo; se ele não carregou, fica a contagem */}
          {arquivo.erros.length > 0 && (
            <ul>
              {arquivo.erros.map((erro) => (
                <li key={`${erro.identificador}-${erro.motivo}`}>
                  <span className="extrato-nao-lida-onde">{erro.identificador}</span>
                  <span>{erro.motivo}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {arquivo.resultado && (
        <Link href={arquivo.resultado} className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
          {versaoAnterior(arquivo) === null ? "Ver conciliação" : `Ver a rodada ${versaoAnterior(arquivo)}`}
        </Link>
      )}
    </section>
  );
}

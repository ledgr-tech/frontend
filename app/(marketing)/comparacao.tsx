"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ladosDaLinha } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/cartao-lancamento";
import { CirculoDeConferir } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/circulo-de-conferir";
import { JustificarEmLote } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/justificar-em-lote";
import { filtrarLinhas, ordenarLinhas, type Coluna, type Filtro, type Ordem } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/ordenar";
import { PainelDoExtrato } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/painel-do-extrato";
import { limparSelecao, podeSelecionar, somarLinhas } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/selecao";
import { rotuloComDecisao, seloDaLinha, situacaoDaLinha, tomDaLinha } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/situacao";
import { anuncioDaSoma, SomaDasSelecionadas } from "@/app/(app)/e/[empresa]/conciliacoes/[id]/soma-das-selecionadas";
import { formatarInteiro, statusDaLinha } from "@/app/(app)/e/[empresa]/dashboard/resumo";
import { IconeOrigem } from "@/app/(app)/e/[empresa]/icone-origem";
import { DiferencaDosSaldos, SaldoDaFolha, temTextoDaDiferenca } from "@/app/(app)/e/[empresa]/saldo";
import { useMovimentoReduzido } from "@/app/reveal";
import type { DiferencaDoSaldo, SaldoDoExtrato } from "@/lib/adaptadores";
import { formatarMoeda, type Decisao, type LinhaComparacao, type StatusLinha } from "@/lib/mock-data";
import { chaveDaLinha } from "@/lib/rodadas";
import { DicaDeArrastar, LARGURA_DO_CELULAR, usePasseioNoCelular } from "./rolagem-lateral";

export type LinhaExtrato = {
  data: string;
  desc: string;
  valorBanco: string | null;
  valorSistema: string | null;
  /** O código do motor; o nome que aparece é o do app (`seloDoStatus`). */
  status: StatusLinha;
  explicacao: string | null;
};

// uma conciliação de uma versão só: toda conferência é desta rodada
const RODADA = 1;
const AUTOR = "você";
// a frase do app para o que bateu (adaptarLinha, lib/adaptadores.ts)
const BATEU = "Bateu: mesmo valor e mesma data nos dois extratos.";
// a janela não grava nada: aprovar e rejeitar nem aparecem (a aprovação está desligada em produção)
const nada = () => Promise.resolve(null);

// o painel ao lado da tabela só a partir daqui (o CSS usa o mesmo limite, .janela-conciliacao em globals.css):
// com menos, a tabela ao lado dele apertaria as descrições a poucas letras, e o painel desce para baixo dela
const LADO_A_LADO = "(min-width: 1280px)";
// no celular a tabela fica no desenho do computador e rola para o lado (globals.css, "rolagem lateral"), em
// vez de virar cartões como no app: um embaixo do outro, os cartões faziam a janela passar de 3.900px
const NO_CELULAR = `(max-width: ${LARGURA_DO_CELULAR}px)`;

/** Se a tela casa com `midia`. No servidor e no primeiro desenho, não: a janela abre como no computador. */
function useMidia(midia: string): boolean {
  const inscrever = useCallback(
    (avisar: () => void) => {
      const consulta = window.matchMedia?.(midia);
      consulta?.addEventListener?.("change", avisar);
      return () => consulta?.removeEventListener?.("change", avisar);
    },
    [midia],
  );
  return useSyncExternalStore(
    inscrever,
    () => window.matchMedia?.(midia).matches ?? false,
    () => false,
  );
}

/** "R$ 12.640,00" em número: os valores da landing já vêm escritos. */
const emReais = (valor: string) => Number(valor.replace(/[^\d,]/g, "").replace(",", "."));

/** As linhas da landing no formato da comparação do app: um par por linha, casado pela descrição. */
function paraLinhas(banco: LinhaExtrato[], sistema: LinhaExtrato[]): LinhaComparacao[] {
  return banco.map((b) => {
    const s = sistema.find((linha) => linha.desc === b.desc);
    return {
      id: b.desc,
      descricao: b.desc,
      data: b.data,
      dataSistema: s?.data,
      valorBanco: b.valorBanco ? emReais(b.valorBanco) : null,
      valorSistema: s?.valorSistema ? emReais(s.valorSistema) : null,
      status: b.status,
      explicacao: b.explicacao ?? (b.status === "match_exato" ? BATEU : null),
      // as explicações da demonstração são as da IA, ligada no lançamento: vêm com o selo, como no produto
      explicacaoPorIa: b.explicacao !== null,
      decisao: null,
      historico: [],
    };
  });
}

/** O cabeçalho que ordena, como o `CabecalhoOrdenavel` da comparação (que mora no page.tsx dela). */
function ColunaOrdenavel({
  coluna,
  ordem,
  onOrdenar,
  folha,
  direita = false,
  centro = false,
  children,
}: {
  coluna: Coluna;
  ordem: Ordem;
  onOrdenar: (coluna: Coluna) => void;
  folha?: "banco" | "sistema";
  direita?: boolean;
  centro?: boolean;
  children: ReactNode;
}) {
  const ativa = ordem.coluna === coluna;
  const classes = [direita && "th-direita", centro && "th-centro", folha && `folha-${folha}`].filter(Boolean).join(" ");
  return (
    <th
      className={classes || undefined}
      style={direita ? { textAlign: "right" } : undefined}
      aria-sort={ativa ? (ordem.crescente ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="th-ordena" onClick={() => onOrdenar(coluna)}>
        <span>{children}</span>
        <span className="th-ordena-seta" aria-hidden="true">
          {ativa ? (ordem.crescente ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

/**
 * "Na prática": a Comparação direta do app numa janela do Mac, só a tabela e o painel, sem o menu e a
 * barra de cima. É a tela de verdade com o agosto da landing: os filtros, a ordenação, a densidade, a
 * coluna Visto e o painel da direita (`PainelDoExtrato`, o mesmo componente do app) funcionam como
 * lá, só que em memória. O ponteiro leva a linha ao painel, o clique a fixa, e justificar tira a linha
 * da revisão. Abaixo de 1280px o painel desce para baixo da tabela; no celular a tabela continua
 * no desenho do computador e rola para o lado, e a janela abre em "Só revisão" enquanto a pessoa não escolhe
 * outro filtro.
 */
export function JanelaDaConciliacao({
  banco,
  sistema,
  saldo,
  saldoSistema,
  diferencaSaldo,
  destaque,
}: {
  banco: LinhaExtrato[];
  sistema: LinhaExtrato[];
  saldo: SaldoDoExtrato;
  /** o saldo do extrato do sistema e a diferença dos finais (banco menos sistema), como o backend manda (#474) */
  saldoSistema: SaldoDoExtrato;
  diferencaSaldo: DiferencaDoSaldo;
  /** a linha que abre no painel */
  destaque: string;
}) {
  const reduzido = useMovimentoReduzido();
  const celular = useMidia(NO_CELULAR);
  // com o painel ao lado, a soma das selecionadas vai nele; sem ele, na faixa da seleção, como no app (#475)
  const painelAoLado = useMidia(LADO_A_LADO);
  const lateral = useRef<HTMLDivElement>(null);
  const janela = useRef<HTMLElement>(null);
  // o passeio inteiro já passou no hero: aqui só uma espiada, para lembrar que o sistema está do lado
  usePasseioNoCelular(janela, ".dash-tabela-rolagem", { reduzido, largura: LARGURA_DO_CELULAR, espera: 900, espiada: 80 });
  const [linhas, setLinhas] = useState(() => paraLinhas(banco, sistema));
  // null até a pessoa escolher: no celular a janela abre no que pede revisão, não nas dez linhas
  const [escolhido, setFiltro] = useState<Filtro | null>(null);
  const filtro: Filtro = escolhido ?? (celular ? "revisao" : "todos");
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "data", crescente: true });
  const [densidade, setDensidade] = useState<"padrao" | "compacta">("padrao");
  const [foco, setFoco] = useState<string | null>(destaque);
  const [fixada, setFixada] = useState(false);
  // escrevendo a justificativa: o ponteiro passando por outra linha não a troca por baixo da pessoa
  const [ocupada, setOcupada] = useState(false);
  // quem já mexeu entendeu o hover: a dica embaixo da janela para de animar (globals.css)
  const [explorada, setExplorada] = useState(false);
  // as divergências marcadas na coluna da esquerda, para somar e justificar de uma vez (#475, #473)
  const [selecao, setSelecao] = useState<ReadonlySet<string>>(() => new Set());

  const emRevisao = filtrarLinhas(linhas, "revisao", RODADA);
  const justificadas = filtrarLinhas(linhas, "justificadas", RODADA).length;
  const conferidas = emRevisao.filter((linha) => situacaoDaLinha(linha, RODADA) === "conferida").length;
  const visiveis = ordenarLinhas(filtrarLinhas(linhas, filtro, RODADA), ordem);
  const linhaEmFoco = linhas.find((linha) => linha.id === foco) ?? null;
  const rolar = reduzido ? "auto" : "smooth";
  // a regra do app: só divergência entra na seleção, e a que deixou de divergir sai dela
  const selecionadas = limparSelecao(selecao, linhas);
  const valendo = new Set(selecionadas);
  const soma = somarLinhas(linhas.filter((linha) => valendo.has(chaveDaLinha(linha))));
  const selecionaveisAVista = visiveis.filter(podeSelecionar).map(chaveDaLinha);
  const todasSelecionadas = selecionaveisAVista.length > 0 && selecionaveisAVista.every((chave) => valendo.has(chave));
  const jaJustificadas = linhas.filter((linha) => valendo.has(chaveDaLinha(linha)) && linha.decisao?.tipo === "justificada").length;
  const alternarSelecao = (chave: string) =>
    setSelecao((atual) => {
      const proxima = new Set(atual);
      if (!proxima.delete(chave)) proxima.add(chave);
      return proxima;
    });
  const alternarTodas = () =>
    setSelecao((atual) => {
      const proxima = new Set(atual);
      for (const chave of selecionaveisAVista) {
        if (todasSelecionadas) proxima.delete(chave);
        else proxima.add(chave);
      }
      return proxima;
    });

  const decidir = (id: string, decisao: Decisao | null) =>
    setLinhas((atual) => atual.map((linha) => (linha.id === id ? { ...linha, decisao } : linha)));
  const decisao = (tipo: Decisao["tipo"], texto: string | null = null): Decisao => ({
    tipo,
    texto,
    autor: AUTOR,
    em: new Date().toISOString(),
    rodada: RODADA,
  });

  const focar = (linha: LinhaComparacao) => {
    setExplorada(true);
    if (!fixada && !ocupada) setFoco(linha.id);
  };
  const fixar = (linha: LinhaComparacao) => {
    if (ocupada) return;
    setExplorada(true);
    if (fixada && foco === linha.id) {
      setFixada(false);
      return;
    }
    setFoco(linha.id);
    setFixada(true);
    // sem margem do lado, o painel fica embaixo da tabela: quem tocou a linha precisa vê-lo
    if (!window.matchMedia?.(LADO_A_LADO)?.matches) {
      lateral.current?.scrollIntoView?.({ behavior: rolar, block: "nearest" });
    }
  };
  // em memória, como a justificativa de uma linha: as selecionadas saem da revisão e a seleção some
  const justificarSelecionadas = async (texto: string) => {
    setLinhas((atual) =>
      atual.map((linha) => (valendo.has(chaveDaLinha(linha)) ? { ...linha, decisao: decisao("justificada", texto) } : linha)),
    );
    setSelecao(new Set());
    return null;
  };
  const ordenar = (coluna: Coluna) =>
    setOrdem((atual) => ({ coluna, crescente: atual.coluna === coluna ? !atual.crescente : true }));

  return (
    <figure
      ref={janela}
      className="janela-conciliacao"
      data-densidade={densidade}
      data-explorado={explorada || undefined}
    >
      <div className="vitrine-janela">
        <div className="vitrine-barra">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <p className="janela-titulo">Comparação direta · agosto/2026</p>
        </div>
        <div className="janela-tela comparacao-grade">
          <div className="comparacao-corpo">
            {/* a faixa da tabela do app: o filtro à esquerda, a densidade à direita */}
            <div className="tabela-ferramentas">
              <div className="tabela-filtros">
                <div className="pills segmentado" role="group" aria-label="Filtrar lançamentos">
                  <button type="button" className="pill" aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>
                    Todos ({linhas.length})
                  </button>
                  <button type="button" className="pill" aria-pressed={filtro === "revisao"} onClick={() => setFiltro("revisao")}>
                    Só revisão ({emRevisao.length})
                  </button>
                  <button
                    type="button"
                    className="pill"
                    aria-pressed={filtro === "justificadas"}
                    onClick={() => setFiltro("justificadas")}
                  >
                    Justificadas ({justificadas})
                  </button>
                </div>
                {/* sem nada a conferir, "0 de 0 conferidas" não diria nada */}
                {emRevisao.length > 0 && (
                  <span className="tabela-progresso">
                    {`${formatarInteiro(conferidas)} de ${formatarInteiro(emRevisao.length)} ${emRevisao.length === 1 ? "conferida" : "conferidas"}`}
                  </span>
                )}
              </div>
              <div className="pills segmentado" role="group" aria-label="Densidade da tabela">
                <button type="button" className="pill" aria-pressed={densidade === "padrao"} onClick={() => setDensidade("padrao")}>
                  Padrão
                </button>
                <button type="button" className="pill" aria-pressed={densidade === "compacta"} onClick={() => setDensidade("compacta")}>
                  Compacta
                </button>
              </div>
            </div>

            {/* sempre montado: a região que já nasce com o texto não é anunciada */}
            <p role="status" className="sr-only">
              {anuncioDaSoma(soma)}
            </p>
            {/* como no app: antes da tabela no DOM, presa no pé da tela depois dela pelo CSS (.lote-faixa) */}
            {selecionadas.length > 0 && (
              <div className="lote-faixa" role="region" aria-label="Linhas selecionadas">
                {painelAoLado ? (
                  <span className="tabela-progresso">
                    {`${formatarInteiro(selecionadas.length)} ${selecionadas.length === 1 ? "selecionada" : "selecionadas"}`}
                  </span>
                ) : (
                  <SomaDasSelecionadas soma={soma} />
                )}
                <JustificarEmLote quantidade={selecionadas.length} jaJustificadas={jaJustificadas} onJustificar={justificarSelecionadas} />
                <button type="button" className="btn btn-secondary" onClick={() => setSelecao(new Set())}>
                  Limpar seleção
                </button>
              </div>
            )}

            <div className="dash-tabela-rolagem">
              <table className="table tabela-folhas folhas-com-eixo" role="table">
                {/* as larguras do app (globals.css): as folhas saem iguais dos dois lados do eixo */}
                <colgroup>
                  <col className="col-selecao" />
                  <col className="col-data" />
                  <col />
                  <col className="col-valor" />
                  <col className="col-eixo" />
                  <col className="col-data" />
                  <col />
                  <col className="col-valor" />
                  <col className="col-conferir" />
                </colgroup>
                <thead role="rowgroup">
                  <tr role="row" className="folhas-titulos">
                    <td className="folha-fora" aria-hidden="true" />
                    <th colSpan={3} scope="colgroup" className="folha-banco folha-titulo">
                      <span className="folha-titulo-conteudo">
                        <IconeOrigem origem="banco" />
                        <span className="folha-nome">Extrato do banco</span>
                        <SaldoDaFolha saldo={saldo} momento="inicial" />
                      </span>
                    </th>
                    <td className="folha-fora" aria-hidden="true" />
                    <th colSpan={3} scope="colgroup" className="folha-sistema folha-titulo">
                      <span className="folha-titulo-conteudo">
                        <IconeOrigem origem="sistema" />
                        <span className="folha-nome">Sistema de gestão</span>
                        <SaldoDaFolha saldo={saldoSistema} momento="inicial" />
                      </span>
                    </th>
                    <td className="folha-fora" aria-hidden="true" />
                  </tr>
                  <tr role="row">
                    <th className="th-selecao">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todas as divergências à vista"
                        checked={todasSelecionadas}
                        disabled={selecionaveisAVista.length === 0}
                        onChange={alternarTodas}
                      />
                    </th>
                    <ColunaOrdenavel coluna="data" ordem={ordem} onOrdenar={ordenar} folha="banco">
                      Data
                    </ColunaOrdenavel>
                    <ColunaOrdenavel coluna="descricao" ordem={ordem} onOrdenar={ordenar} folha="banco">
                      Descrição
                    </ColunaOrdenavel>
                    <ColunaOrdenavel coluna="valorBanco" ordem={ordem} onOrdenar={ordenar} folha="banco" direita>
                      Banco
                    </ColunaOrdenavel>
                    <ColunaOrdenavel coluna="status" ordem={ordem} onOrdenar={ordenar} centro>
                      Status
                    </ColunaOrdenavel>
                    {/* como no app: a data e a descrição que ordenam são as do banco */}
                    <th className="folha-sistema">Data</th>
                    <th className="folha-sistema">Descrição</th>
                    <ColunaOrdenavel coluna="valorSistema" ordem={ordem} onOrdenar={ordenar} folha="sistema" direita>
                      Sistema
                    </ColunaOrdenavel>
                    <th className="th-conferir" title="Marque as divergências que você já olhou. As que bateram não precisam.">
                      Visto
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {visiveis.map((linha) => {
                    const situacao = situacaoDaLinha(linha, RODADA);
                    // conferida ou justificada, a linha sai da cor da categoria: alguém já cuidou dela
                    const tom = tomDaLinha(linha, RODADA);
                    const { banco: ladoBanco, sistema: ladoSistema } = ladosDaLinha(linha);
                    // o campo errado em vermelho, como no app: a data na "Data diverge", o valor no resto
                    const campoErrado = situacao === "a_conferir" ? (linha.status === "divergente_data" ? "data" : "valor") : null;
                    const diverge = (campo: "valor" | "data") => (campoErrado === campo ? "true" : undefined);
                    const marcar = (campo: "valor" | "data", texto: string) =>
                      diverge(campo) ? <span className="marca-diverge">{texto}</span> : texto;
                    const emFoco = foco === linha.id;
                    return (
                      // o tom do status pinta o hover: a linha acende na cor do veredito dela
                      <tr
                        key={linha.id}
                        role="row"
                        data-tom={tom}
                        data-situacao={situacao}
                        data-foco={emFoco ? "" : undefined}
                        data-fixo={emFoco && fixada ? "" : undefined}
                        onMouseEnter={() => focar(linha)}
                        onClick={(evento) => {
                          if (!(evento.target as Element).closest("button, input")) fixar(linha);
                        }}
                      >
                        <td role="cell" className="celula-selecao">
                          {podeSelecionar(linha) && (
                            <input
                              type="checkbox"
                              aria-label={`Selecionar: ${linha.data} ${linha.descricao}`}
                              checked={valendo.has(chaveDaLinha(linha))}
                              onChange={() => alternarSelecao(chaveDaLinha(linha))}
                            />
                          )}
                        </td>
                        {ladoBanco ? (
                          <>
                            <td role="cell" data-rotulo="Data" data-diverge={diverge("data")} className="dash-celula-fraca folha-banco">
                              {marcar("data", ladoBanco.data)}
                            </td>
                            <td
                              role="cell"
                              data-rotulo="Descrição"
                              data-destaque="true"
                              className="folha-banco celula-descricao"
                              title={ladoBanco.descricao}
                            >
                              {/* botão de verdade, como no app: o teclado e o toque também escolhem a linha */}
                              <button type="button" className="celula-abrir" onClick={() => fixar(linha)} onFocus={() => focar(linha)}>
                                {ladoBanco.descricao}
                              </button>
                            </td>
                            <td role="cell" data-rotulo="Banco" data-diverge={diverge("valor")} className="dash-valor-celula folha-banco">
                              {marcar("valor", formatarMoeda(linha.valorBanco!))}
                            </td>
                          </>
                        ) : (
                          <td role="cell" colSpan={3} data-rotulo="Banco" className="folha-banco folha-vazia">
                            <span className="folha-vazia-marca">sem lançamento no banco</span>
                          </td>
                        )}
                        {/* o nome curto cabe no eixo; o inteiro fica para o leitor de tela */}
                        <td role="cell" data-rotulo="Status" className="celula-status">
                          <span className={`selo selo-${tom}`} aria-hidden="true">
                            {seloDaLinha(linha, RODADA).rotulo}
                          </span>
                          <span className="sr-only">{rotuloComDecisao(statusDaLinha(linha).rotulo, situacao)}</span>
                        </td>
                        {ladoSistema ? (
                          <>
                            <td
                              role="cell"
                              data-rotulo="Data no sistema"
                              data-diverge={diverge("data")}
                              className="dash-celula-fraca folha-sistema"
                            >
                              {marcar("data", ladoSistema.data)}
                            </td>
                            <td role="cell" data-rotulo="Descrição no sistema" className="folha-sistema celula-descricao" title={ladoSistema.descricao}>
                              {ladoSistema.descricao}
                            </td>
                            <td role="cell" data-rotulo="Sistema" data-diverge={diverge("valor")} className="dash-valor-celula folha-sistema">
                              {marcar("valor", formatarMoeda(linha.valorSistema!))}
                            </td>
                          </>
                        ) : (
                          // uma célula só no lugar de três traços, como no app: a folha diz que falta
                          <td role="cell" colSpan={3} data-rotulo="Sistema" className="folha-sistema folha-vazia">
                            <span className="folha-vazia-marca">sem lançamento no sistema</span>
                          </td>
                        )}
                        <td role="cell" data-rotulo="Visto" className="celula-conferir">
                          {(situacao === "a_conferir" || situacao === "conferida") && (
                            <CirculoDeConferir
                              linha={linha}
                              conferida={situacao === "conferida"}
                              voltou={false}
                              onConferir={() => decidir(linha.id, situacao === "conferida" ? null : decisao("conferida"))}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot role="rowgroup">
                  <tr role="row">
                    <td role="cell" className="folha-fora" aria-hidden="true" />
                    <td role="cell" colSpan={3} className="folha-banco">
                      <SaldoDaFolha saldo={saldo} momento="final" />
                    </td>
                    <td role="cell" className="folha-fora" aria-hidden={temTextoDaDiferenca(diferencaSaldo) ? undefined : true}>
                      <DiferencaDosSaldos diferenca={diferencaSaldo} />
                    </td>
                    <td role="cell" colSpan={3} className="folha-sistema">
                      <SaldoDaFolha saldo={saldoSistema} momento="final" />
                    </td>
                    <td role="cell" className="celula-conferir" />
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* só no celular (CSS), onde a tabela rola para o lado */}
            {visiveis.length > 0 && <DicaDeArrastar texto="Arraste para ver o sistema" />}
            {/* os textos da tabela vazia do app (textoDoVazio, na comparação) */}
            {visiveis.length === 0 && (
              <p className="tabela-vazia">
                {filtro === "justificadas"
                  ? "Nenhuma linha justificada nesta conciliação."
                  : "Nada em revisão nesta competência: o que não bateu está justificado."}
              </p>
            )}
          </div>

          <div className="comparacao-lateral" ref={lateral}>
            <PainelDoExtrato
              linha={linhaEmFoco}
              fixada={fixada}
              rodada={RODADA}
              linhas={linhas}
              real={false}
              podeDecidir
              podeAprovar={false}
              onJustificar={async (texto) => {
                if (linhaEmFoco) decidir(linhaEmFoco.id, decisao("justificada", texto));
                return null;
              }}
              onAprovar={nada}
              onRejeitar={nada}
              // na demonstração a justificativa nasce valendo, e desfazer devolve a linha à revisão
              onDesfazer={async () => {
                if (linhaEmFoco) decidir(linhaEmFoco.id, null);
                return null;
              }}
              onDesfazerAprovacao={nada}
              onExplicada={() => {}}
              // o detalhe inteiro de uma linha é o que "Por dentro", logo abaixo, conta
              onAbrirDetalhe={() => document.getElementById("por-dentro")?.scrollIntoView({ behavior: rolar, block: "start" })}
              onOcupar={setOcupada}
              soma={painelAoLado && soma.quantidade > 0 ? soma : undefined}
            />
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Uma conciliação de agosto aberta na Comparação direta, só a tela, sem o resto do app: o extrato do banco ao
        lado do sistema de gestão, cada linha com o status, o saldo inicial no topo e o final no pé de cada coluna,
        com a diferença dos saldos finais entre elas, e o painel da direita com o lançamento em foco. Dá para filtrar,
        ordenar, marcar as divergências conferidas, selecionar divergências para ver a soma e justificar uma ou várias de uma vez.
      </figcaption>
    </figure>
  );
}

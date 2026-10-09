"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { ehDivergencia } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import {
  fecharConciliacao,
  formatarMoeda,
  type Conciliacao,
  type Decisao,
  type LinhaComparacao,
  type TipoEvento,
} from "@/lib/mock-data";
import { chaveDaLinha, type Mudancas } from "@/lib/rodadas";
import {
  estaResolvida,
  formatarDataHora,
  formatarInteiro,
  rotuloCurto,
  seloDoStatus,
  statusDaLinha,
} from "../../dashboard/resumo";
import { FALHA_AO_CARREGAR, useConciliacao } from "../usar-conciliacao";
import { EsqueletoTela } from "../../esqueleto";
import { filtrarLinhas, ordenarLinhas, type Coluna, type Filtro, type Ordem } from "./ordenar";
import { continuaDivergindo, decisoesLigadas, situacaoDaLinha } from "./situacao";
import { decidir, type ResultadoDaDecisao } from "./decidir";
import { aplicarDensidade, densidadeAtual, type Densidade } from "../../densidade";
import { IconeOrigem, type Origem } from "../../icone-origem";
import { CartaoLancamento, ladosDaLinha, type CartaoAberto } from "./cartao-lancamento";
import { Relatorio } from "./relatorio";
import { NovaVersao } from "./nova-versao";
import { LinhaDasRodadas } from "./linha-das-rodadas";
import { CirculoDeConferir } from "./circulo-de-conferir";
import { competencia, tituloDaCompetencia } from "../../fechamentos/fechamento";
import { larguraDoValor } from "./largura";
import { Reveal } from "@/app/reveal";
import { MensagemErro } from "@/app/(auth)/_compartilhado/mensagem-erro";
import { Cabecalho } from "../../cabecalho";
import { SeloIa } from "../../selo-ia";

/**
 * "Desde a rodada 1: 4 passaram a bater · 2 continuam divergindo · 1 nova divergência".
 * As três partes sempre: num relatório, o zero também informa.
 */
function textoDasMudancas(anterior: number, { passaramABater, continuamDivergindo, novas }: Mudancas): string {
  const parte = (quantidade: number, um: string, varios: string) =>
    `${formatarInteiro(quantidade)} ${quantidade === 1 ? um : varios}`;
  const partes = [
    parte(passaramABater, "passou a bater", "passaram a bater"),
    parte(continuamDivergindo, "continua divergindo", "continuam divergindo"),
    parte(novas, "nova divergência", "novas divergências"),
  ];
  return `Desde a rodada ${anterior}: ${partes.join(" · ")}`;
}

/** Por que a tabela ficou vazia no filtro escolhido. */
function textoDoVazio(filtro: Filtro, justificadas: number): string {
  if (ehDivergencia(filtro)) return `Nenhuma linha em “${seloDoStatus(filtro).rotulo}” nesta conciliação.`;
  if (filtro === "justificadas") return "Nenhuma linha justificada nesta conciliação.";
  // nem tudo bateu: o que sobrou foi justificado
  if (justificadas > 0) return "Nada em revisão nesta competência: o que não bateu está justificado.";
  return "Nada em revisão nesta competência: todos os lançamentos bateram.";
}

/** Quantas linhas por página. 4.218 lançamentos não cabem numa tela. */
const POR_PAGINA = 25;

/** Toque não tem hover: lá o toque na descrição já abre o diálogo da linha. */
function temHover(): boolean {
  return window.matchMedia?.("(hover: hover)").matches ?? false;
}

/**
 * Cabeçalho ordenável. Vive no escopo do módulo de propósito: definido dentro do
 * componente da página, cada render criava um tipo novo e o <thead> inteiro
 * remontava — perdendo foco de teclado no meio de uma ordenação.
 */
function CabecalhoOrdenavel({
  coluna,
  ordem,
  onOrdenar,
  children,
  direita = false,
  centro = false,
  folha,
}: {
  coluna: Coluna;
  ordem: Ordem;
  onOrdenar: (coluna: Coluna) => void;
  children: React.ReactNode;
  direita?: boolean;
  centro?: boolean;
  /** Em qual das duas folhas a coluna mora; sem folha, fica no fundo da página. */
  folha?: Origem;
}) {
  const ativa = ordem.coluna === coluna;
  const classes = [direita && "th-direita", centro && "th-centro", folha && `folha-${folha}`]
    .filter(Boolean)
    .join(" ");
  return (
    <th
      className={classes || undefined}
      style={direita ? { textAlign: "right" } : undefined}
      aria-sort={ativa ? (ordem.crescente ? "ascending" : "descending") : "none"}
    >
      <button type="button" className="th-ordena" onClick={() => onOrdenar(coluna)}>
        {children}
        <span className="th-ordena-seta" aria-hidden="true">
          {ativa ? (ordem.crescente ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ConciliacaoPage() {
  const params = useParams<{ id: string }>();
  const busca = useSearchParams();
  const sistema = busca.get("sistema") || undefined;
  const router = useRouter();
  const { estado, substituir, recarregar } = useConciliacao(params.id, sistema);
  // a janela da linha guarda a chave, não a linha: depois de justificar, ela mostra a linha como voltou
  const [chaveAberta, setChaveAberta] = useState<string | null>(null);
  const [cartao, setCartao] = useState<CartaoAberto | null>(null);
  const idCartao = useId();
  // a categoria do relatório chega pela URL: quem volta do detalhe de uma linha
  // reencontra o mesmo recorte
  const [filtro, setFiltro] = useState<Filtro>(() => {
    const status = busca.get("status");
    return ehDivergencia(status) ? status : "todos";
  });
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "data", crescente: true });
  const [pagina, setPagina] = useState(0);
  // null enquanto não lemos a preferência: só existe no cliente
  const [densidade, setDensidade] = useState<Densidade | null>(null);
  // a decisão que não gravou, dita acima da tabela
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);
  // as linhas com uma decisão a caminho: o segundo clique não manda o contrário por cima
  const gravando = useRef(new Set<string>());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDensidade(densidadeAtual());
  }, []);

  // o cartão é fixo na tela: rolar ou redimensionar o deixaria longe da linha
  useEffect(() => {
    if (!cartao) return;
    const fechar = () => setCartao(null);
    window.addEventListener("scroll", fechar, { capture: true, passive: true });
    window.addEventListener("resize", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, { capture: true });
      window.removeEventListener("resize", fechar);
    };
  }, [cartao]);

  if (estado.situacao === "carregando") {
    return <EsqueletoTela />;
  }

  if (estado.situacao === "ausente") {
    return (
      <div style={{ padding: "48px 0" }}>
        <p>Conciliação não encontrada.</p>
      </div>
    );
  }

  if (estado.situacao === "falhou") {
    return (
      <div style={{ padding: "48px 0" }}>
        <p role="alert">{FALHA_AO_CARREGAR}</p>
      </div>
    );
  }

  const { conciliacao, real, truncada, rodada, rodadas, mudancas, fechamento } = estado;

  function fechar() {
    const atualizada = fecharConciliacao(conciliacao.id);
    if (atualizada) substituir(atualizada);
  }

  if (conciliacao.status === "fechada") {
    return (
      <Fechamento
        conciliacao={conciliacao}
        onNovaConciliacao={() => router.push("/conciliacoes/nova")}
      />
    );
  }

  // a rodada das linhas decide se uma conferência ainda vale (situacao.ts)
  const rodadaDasLinhas = conciliacao.rodada ?? 1;
  const ligadas = decisoesLigadas(conciliacao, real);
  const emRevisao = filtrarLinhas(conciliacao.linhas, "revisao", rodadaDasLinhas);
  const justificadas = filtrarLinhas(conciliacao.linhas, "justificadas", rodadaDasLinhas);
  const conferidas = emRevisao.filter((linha) => situacaoDaLinha(linha, rodadaDasLinhas) === "conferida").length;
  const larguraValor = larguraDoValor(conciliacao.linhas);
  const categoria = ehDivergencia(filtro) ? filtro : null;
  const ordenadas = ordenarLinhas(filtrarLinhas(conciliacao.linhas, filtro, rodadaDasLinhas), ordem);
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  // limita em vez de corrigir num efeito: filtrar pode encurtar a lista e deixar a
  // página atual fora do fim, e reagir a isso com setState causaria render extra
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = ordenadas.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  function escolherDensidade(proxima: Densidade) {
    aplicarDensidade(proxima);
    setDensidade(proxima);
  }

  function escolherFiltro(proximo: Filtro) {
    setFiltro(proximo);
    setPagina(0);
    // replaceState, não navegação: o Next sincroniza o useSearchParams sem remontar
    // a página nem buscar as linhas de novo, e o histórico não ganha um passo por clique
    const url = new URLSearchParams(window.location.search);
    if (ehDivergencia(proximo)) url.set("status", proximo);
    else url.delete("status");
    const query = url.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  function alternarOrdem(coluna: Coluna) {
    setOrdem((atual) =>
      atual.coluna === coluna ? { coluna, crescente: !atual.crescente } : { coluna, crescente: true },
    );
    setPagina(0);
  }

  // decidir só onde há onde gravar, só na rodada que vale (a passada é para ler) e só com o mês
  // aberto: no fechado, o backend recusa (409) até reabrir
  const podeDecidir = ligadas && (!rodada || rodada.numero === rodada.total) && !fechamento;
  const linhaAberta = chaveAberta === null ? null : (conciliacao.linhas.find((linha) => chaveDaLinha(linha) === chaveAberta) ?? null);

  /** Troca uma linha na conciliação que estiver na tela quando a resposta chegar. */
  function trocarLinha(chave: string, troca: (linha: LinhaComparacao) => LinhaComparacao) {
    substituir((atual) => ({
      ...atual,
      linhas: atual.linhas.map((linha) => (chaveDaLinha(linha) === chave ? troca(linha) : linha)),
    }));
  }

  /**
   * Grava uma decisão e põe na tela a linha como voltou. Devolve o motivo de não ter
   * gravado, ou null. Sessão vencida vai ao login; linha que mudou ou mês fechado recarrega a tela.
   */
  async function gravarDecisao(linha: LinhaComparacao, tipo: TipoEvento, texto?: string): Promise<string | null> {
    const chave = chaveDaLinha(linha);
    let resposta: ResultadoDaDecisao;
    try {
      resposta = await decidir({ conciliacao, real, linha, tipo, texto });
    } catch {
      // a Server Action lançou (rede caída, deploy novo no meio) em vez de devolver um Resultado
      return "Não foi possível falar com o servidor.";
    }
    if (resposta.ok) {
      const gravada = resposta.conciliacao.linhas.find((atual) => chaveDaLinha(atual) === chave);
      if (gravada) trocarLinha(chave, () => gravada);
      return null;
    }
    if (resposta.status === 401) router.push("/login");
    // outra rodada entrou no meio (404), ou fecharam o mês com a tela aberta (409): recarregar
    // traz a linha de agora, ou a tela travada com o aviso de mês fechado
    if (resposta.status === 404 || resposta.status === 409) recarregar();
    return resposta.erro;
  }

  /** A caixa do eixo. Otimista: marca na hora e volta, com o motivo, se não gravar. */
  async function conferir(linha: LinhaComparacao) {
    const chave = chaveDaLinha(linha);
    if (gravando.current.has(chave)) return;
    gravando.current.add(chave);
    const marcada = situacaoDaLinha(linha, rodadaDasLinhas) === "conferida";
    const otimista: Decisao | null = marcada
      ? null
      : { tipo: "conferida", texto: null, autor: "Você", em: new Date().toISOString(), rodada: rodadaDasLinhas };
    setErroDecisao(null);
    trocarLinha(chave, (atual) => ({ ...atual, decisao: otimista }));

    const erro = await gravarDecisao(linha, marcada ? "conferencia_desfeita" : "conferida");
    gravando.current.delete(chave);
    if (erro === null) return;
    trocarLinha(chave, (atual) => ({ ...atual, decisao: linha.decisao }));
    setErroDecisao(erro);
  }

  return (
    <div>
      <Cabecalho
        titulo="Comparação direta"
        contexto={[
          // sem data nenhuma, o mês é o "Conciliação" genérico do adaptador
          conciliacao.mes !== "Conciliação" && `competência ${conciliacao.mes.toLowerCase()}`,
          `${formatarInteiro(conciliacao.linhas.length)} ${conciliacao.linhas.length === 1 ? "lançamento" : "lançamentos"}`,
          // a rodada só aparece quando há mais de uma: "rodada 1" sozinha é ruído
          rodada &&
            rodada.total > 1 &&
            `rodada ${rodada.numero} · ${rodada.arquivoSistema}, ${formatarDataHora(rodada.executadaEm)}`,
        ]}
        acoes={
          // só conciliação de verdade, só na rodada que vale (a passada é para ler) e com o mês aberto
          real &&
          !fechamento &&
          (!rodada || rodada.numero === rodada.total) && (
            <NovaVersao
              extratoBancoId={conciliacao.id}
              onConcluida={() => {
                // a URL só do banco abre a rodada mais recente; se ela já era essa, recarrega
                router.replace(caminhoDaConciliacao(conciliacao.id));
                recarregar();
              }}
            />
          )
        }
      />
      <div style={{ padding: "24px 0 72px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* A tela ordena e filtra a lista inteira no cliente, então só faz sentido
            com a lista inteira em mãos. Se o teto de páginas cortou, dizer isso é
            melhor do que deixar alguém ordenar por valor sobre meia conciliação. */}
        {truncada && (
          <p role="status" className="selo selo-atencao" style={{ alignSelf: "flex-start" }}>
            Mostrando as primeiras {conciliacao.linhas.length} linhas desta conciliação.
          </p>
        )}
        {/* o mês fechado trava conferir, justificar e conciliar de novo (backend #86): a tela não
            oferece o que o backend recusaria, e diz onde reabrir */}
        {fechamento && (
          <p role="status" aria-label="Mês fechado" className="mes-fechado-aviso">
            {`${tituloDaCompetencia(fechamento.competencia)} está fechado. Para conferir, justificar ou conciliar de novo, reabra o fechamento. `}
            <Link href={`/fechamentos?mes=${fechamento.competencia}`}>Ver o fechamento</Link>
          </p>
        )}
        {/* a faixa da rodada: o aviso da rodada passada (só para ler, leva à que vale) ou o que
            mudou desde a anterior, e à direita a linha das rodadas, que chega ao fechamento */}
        {rodada && (rodada.numero < rodada.total || mudancas || rodadas.length > 1) && (
          <div className="rodada-faixa">
            {rodada.numero < rodada.total ? (
              <p role="status">
                {`Rodada ${rodada.numero} de ${rodada.total} · `}
                <Link href={caminhoDaConciliacao(conciliacao.id)}>ver a mais recente</Link>
              </p>
            ) : (
              mudancas && <p>{textoDasMudancas(rodada.numero - 1, mudancas)}</p>
            )}
            {rodadas.length > 1 && (
              <LinhaDasRodadas
                extratoBancoId={conciliacao.id}
                rodadas={rodadas}
                aberta={rodada.numero}
                // o mês do fechamento como Fechamentos o calcula: o do período do extrato do banco
                mes={competencia(rodada.periodoInicio, rodada.executadaEm)}
                // o que falta é o da rodada que vale; numa passada, a conta não diria nada
                pendentes={rodada.numero === rodada.total ? emRevisao.length : null}
              />
            )}
          </div>
        )}
        {/* desligar uma categoria volta ao "Só revisão": as cinco são o que ele junta.
            As justificadas saem das categorias e são contadas à parte. */}
        <Reveal>
          <Relatorio
            linhas={emRevisao}
            justificadas={justificadas.length}
            ativa={categoria}
            onEscolher={(status) => escolherFiltro(status ?? "revisao")}
          />
        </Reveal>

        {/* uma faixa só de controles, colada na tabela: o filtro à esquerda, a densidade à direita */}
        <Reveal delay={0.08} className="tabela-ferramentas">
          <div className="tabela-filtros">
            <div className="pills segmentado" role="group" aria-label="Filtrar lançamentos">
              <button
                type="button"
                className="pill"
                aria-pressed={filtro === "todos"}
                onClick={() => escolherFiltro("todos")}
              >
                Todos ({conciliacao.linhas.length})
              </button>
              <button
                type="button"
                className="pill"
                aria-pressed={filtro === "revisao"}
                onClick={() => escolherFiltro("revisao")}
              >
                Só revisão ({emRevisao.length})
              </button>
              {/* sem onde gravar a decisão, não há justificada para filtrar */}
              {ligadas && (
                <button
                  type="button"
                  className="pill"
                  aria-pressed={filtro === "justificadas"}
                  onClick={() => escolherFiltro("justificadas")}
                >
                  Justificadas ({justificadas.length})
                </button>
              )}
            </div>
            {/* sem nada a conferir, "0 de 0 conferidas" não diria nada */}
            {ligadas && emRevisao.length > 0 && (
              <span className="tabela-progresso">
                {`${formatarInteiro(conferidas)} de ${formatarInteiro(emRevisao.length)} ${emRevisao.length === 1 ? "conferida" : "conferidas"}`}
              </span>
            )}
          </div>
          {densidade !== null && (
            <div className="pills segmentado" role="group" aria-label="Densidade da tabela">
              <button
                type="button"
                className="pill"
                aria-pressed={densidade === "padrao"}
                onClick={() => escolherDensidade("padrao")}
              >
                Padrão
              </button>
              <button
                type="button"
                className="pill"
                aria-pressed={densidade === "compacta"}
                onClick={() => escolherDensidade("compacta")}
              >
                Compacta
              </button>
            </div>
          )}
        </Reveal>

        {erroDecisao && (
          <p role="alert" className="selo selo-risco decisao-erro">
            {erroDecisao}
          </p>
        )}

        <Reveal delay={0.08}>
          <div className="dash-tabela-rolagem tabela-cartoes">
            <table
              className="table tabela-folhas folhas-com-eixo"
              role="table"
              // a coluna de valor cresce para o maior valor da conciliação, quando passa dos milhões
              style={larguraValor ? ({ "--valor-largura": larguraValor } as CSSProperties) : undefined}
            >
              {/* larguras fixas (globals.css): as folhas saem iguais dos dois lados do eixo,
                  e as colunas não mudam de largura ao trocar de página ou de filtro */}
              <colgroup>
                <col className="col-data" />
                <col />
                <col className="col-valor" />
                <col className="col-eixo" />
                <col className="col-data" />
                <col />
                <col className="col-valor" />
                {podeDecidir && <col className="col-conferir" />}
              </colgroup>
              <thead role="rowgroup">
                {/* Duas folhas, como a "folha a folha" do design: o extrato do banco
                    e o do sistema são coisas diferentes, cada um com seu tom. O status
                    fica no eixo entre as duas, como no design: é o veredito sobre o par,
                    e o olho passa por ele no caminho de um lado ao outro. */}
                <tr role="row" className="folhas-titulos">
                  <th colSpan={3} scope="colgroup" className="folha-banco folha-titulo">
                    <span className="folha-titulo-conteudo">
                      <IconeOrigem origem="banco" />
                      <span className="folha-nome">Extrato do banco</span>
                      <span className="folha-etiqueta">Fonte da verdade</span>
                    </span>
                  </th>
                  <td className="folha-fora" aria-hidden="true" />
                  <th colSpan={3} scope="colgroup" className="folha-sistema folha-titulo">
                    <span className="folha-titulo-conteudo">
                      <IconeOrigem origem="sistema" />
                      <span className="folha-nome">Sistema de gestão</span>
                    </span>
                  </th>
                  {podeDecidir && <td className="folha-fora" aria-hidden="true" />}
                </tr>
                <tr role="row">
                  <CabecalhoOrdenavel coluna="data" ordem={ordem} onOrdenar={alternarOrdem} folha="banco">
                    Data
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel coluna="descricao" ordem={ordem} onOrdenar={alternarOrdem} folha="banco">
                    Descrição
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel
                    coluna="valorBanco"
                    ordem={ordem}
                    onOrdenar={alternarOrdem}
                    direita
                    folha="banco"
                  >
                    Banco
                  </CabecalhoOrdenavel>
                  <CabecalhoOrdenavel coluna="status" ordem={ordem} onOrdenar={alternarOrdem} centro>
                    Status
                  </CabecalhoOrdenavel>
                  {/* ponytail: sem ordenar — a data e a descrição que ordenam são as do
                      banco. Ordenar pelo lado do sistema entra se alguém pedir. */}
                  <th className="folha-sistema">Data</th>
                  <th className="folha-sistema">Descrição</th>
                  <CabecalhoOrdenavel
                    coluna="valorSistema"
                    ordem={ordem}
                    onOrdenar={alternarOrdem}
                    direita
                    folha="sistema"
                  >
                    Sistema
                  </CabecalhoOrdenavel>
                  {/* a conferência no fim da linha, com nome: depois de ler o par, "já conferi" */}
                  {podeDecidir && (
                    <th className="th-conferir" title="Conferida">
                      <CircleCheck size={15} aria-hidden="true" />
                      <span className="sr-only">Conferida</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody role="rowgroup">
                {visiveis.map((linha) => {
                  const status = statusDaLinha(linha);
                  const situacao = situacaoDaLinha(linha, rodadaDasLinhas);
                  // conferida ou justificada, a linha sai da cor da categoria: alguém já cuidou dela
                  const tom = situacao === "conferida" || situacao === "justificada" ? "neutro" : status.tom;
                  const { banco, sistema } = ladosDaLinha(linha);
                  // o cartão só nas linhas que pedem revisão, como na landing: nas batidas seria ruído
                  const comCartao = !estaResolvida(linha.status);
                  // a divergência pinta o campo em questão dos dois lados, como um diff
                  // destaca o trecho que mudou: os valores, ou as datas
                  const diverge = (campo: "valor" | "data") =>
                    linha.status === `divergente_${campo}` ? "true" : undefined;
                  // e o texto dele vai numa marca, que acende de leve com o ponteiro na linha
                  const marcar = (campo: "valor" | "data", texto: string) =>
                    diverge(campo) ? <span className="marca-diverge">{texto}</span> : texto;
                  // a descrição fica numa linha só (globals.css); o texto inteiro vem na dica do
                  // navegador, menos onde o cartão abre, que já traz as duas inteiras
                  const dica = (descricao: string) => (comCartao ? undefined : descricao);
                  // o cartão sai do selo do status, centrado nele: é o veredito que ele explica
                  const abrirCartao = (tr: Element) =>
                    setCartao({
                      linha,
                      ancora: (tr.querySelector(".celula-status .selo") ?? tr.querySelector(".celula-status") ?? tr).getBoundingClientRect(),
                    });
                  const fecharCartao = () =>
                    setCartao((atual) => (atual?.linha.id === linha.id ? null : atual));
                  // botão de verdade: a linha inteira com onClick não era alcançável por
                  // teclado. Fica na descrição do banco; sem lançamento no banco, na do sistema.
                  const abrir = (descricao: string) => (
                    <button
                      type="button"
                      className="celula-abrir"
                      aria-describedby={cartao?.linha.id === linha.id ? idCartao : undefined}
                      onClick={() => {
                        setCartao(null);
                        setChaveAberta(chaveDaLinha(linha));
                      }}
                      onFocus={(evento) => comCartao && abrirCartao(evento.currentTarget.closest("tr")!)}
                      onBlur={fecharCartao}
                      onKeyDown={(evento) => evento.key === "Escape" && fecharCartao()}
                    >
                      {descricao}
                    </button>
                  );
                  return (
                    // o tom do status pinta o hover: a linha acende na cor do veredito dela
                    <tr
                      key={linha.id}
                      role="row"
                      data-tom={tom}
                      data-situacao={situacao}
                      onMouseEnter={
                        comCartao ? (evento) => temHover() && abrirCartao(evento.currentTarget) : undefined
                      }
                      onMouseLeave={comCartao ? fecharCartao : undefined}
                    >
                      {banco ? (
                        <>
                          <td
                            role="cell"
                            data-rotulo="Data"
                            data-diverge={diverge("data")}
                            className="dash-celula-fraca folha-banco"
                          >
                            {marcar("data", banco.data)}
                          </td>
                          <td
                            role="cell"
                            data-rotulo="Descrição"
                            data-destaque="true"
                            className="folha-banco celula-descricao"
                            title={dica(banco.descricao)}
                          >
                            {abrir(banco.descricao)}
                          </td>
                          <td
                            role="cell"
                            data-rotulo="Banco"
                            data-diverge={diverge("valor")}
                            className="dash-valor-celula folha-banco"
                          >
                            {linha.valorBanco !== null ? marcar("valor", formatarMoeda(linha.valorBanco)) : "—"}
                          </td>
                        </>
                      ) : (
                        // uma célula só no lugar de três traços: a folha diz que falta, não que está em branco
                        <td role="cell" colSpan={3} data-rotulo="Banco" className="folha-banco folha-vazia">
                          <span className="folha-vazia-marca">sem lançamento no banco</span>
                        </td>
                      )}
                      {/* o nome curto cabe no eixo; o inteiro fica para o leitor de tela. O que
                          bateu vai sem selo: só o que pede revisão ganha cor, e o olho vai direto nele */}
                      <td role="cell" data-rotulo="Status" className="celula-status">
                        <span className={comCartao ? `selo selo-${tom}` : "status-batido"} aria-hidden="true">
                          {situacao === "justificada" ? "Justificada" : rotuloCurto(linha)}
                        </span>
                        <span className="sr-only">
                          {situacao === "justificada" ? `${status.rotulo} · justificada` : status.rotulo}
                        </span>
                      </td>
                      {sistema ? (
                        <>
                          <td
                            role="cell"
                            data-rotulo="Data no sistema"
                            data-diverge={diverge("data")}
                            className="dash-celula-fraca folha-sistema"
                          >
                            {marcar("data", sistema.data)}
                          </td>
                          <td
                            role="cell"
                            data-rotulo="Descrição no sistema"
                            data-destaque={banco ? undefined : "true"}
                            className="folha-sistema celula-descricao"
                            title={dica(sistema.descricao)}
                          >
                            {banco ? sistema.descricao : abrir(sistema.descricao)}
                          </td>
                          <td
                            role="cell"
                            data-rotulo="Sistema"
                            data-diverge={diverge("valor")}
                            className="dash-valor-celula folha-sistema"
                          >
                            {linha.valorSistema !== null ? marcar("valor", formatarMoeda(linha.valorSistema)) : "—"}
                          </td>
                        </>
                      ) : (
                        <td role="cell" colSpan={3} data-rotulo="Sistema" className="folha-sistema folha-vazia">
                          <span className="folha-vazia-marca">sem lançamento no sistema</span>
                        </td>
                      )}
                      {podeDecidir && (
                        <td role="cell" data-rotulo="Conferida" className="celula-conferir">
                          {(situacao === "a_conferir" || situacao === "conferida") && (
                            <CirculoDeConferir
                              linha={linha}
                              conferida={situacao === "conferida"}
                              voltou={continuaDivergindo(linha, rodadaDasLinhas)}
                              onConferir={() => conferir(linha)}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {cartao && <CartaoLancamento id={idCartao} aberto={cartao} rodada={rodadaDasLinhas} />}

          {ordenadas.length === 0 && (
            <p className="tabela-vazia">{textoDoVazio(filtro, justificadas.length)}</p>
          )}

          {totalPaginas > 1 && (
            <div className="paginacao">
              <span className="paginacao-conta">
                {paginaAtual * POR_PAGINA + 1}–
                {Math.min((paginaAtual + 1) * POR_PAGINA, ordenadas.length)} de {ordenadas.length}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={paginaAtual === 0}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  Anterior
                </button>
                <span className="paginacao-conta">
                  {paginaAtual + 1} / {totalPaginas}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={paginaAtual >= totalPaginas - 1}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </Reveal>

        {/* Fechar o mês grava no mock. Com dado do backend não há endpoint que
            persista isso, então o botão não aparece em vez de fingir que fechou. */}
        {!real && (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button type="button" className="btn btn-primary" onClick={fechar}>
              Fechar mês
            </button>
          </div>
        )}

        {linhaAberta && (
          <EspiaDaLinha
            // uma janela por linha: abrir outra linha monta outra, e o showModal roda de novo
            key={linhaAberta.id}
            linha={linhaAberta}
            rodada={rodadaDasLinhas}
            podeDecidir={podeDecidir}
            detalhe={caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId, linhaAberta.id)}
            onJustificar={(texto) => gravarDecisao(linhaAberta, "justificada", texto)}
            onDesfazer={() => gravarDecisao(linhaAberta, "justificativa_desfeita")}
            onFechar={() => setChaveAberta(null)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * O espia rápido de uma linha: os dois valores, a explicação e o caminho para o
 * detalhe inteiro. <dialog> nativo com showModal, como as configurações: prende
 * o foco, fecha no Esc e deixa o fundo inerte. Ao fechar, o foco volta ao botão
 * da linha que o abriu.
 *
 * ponytail: o detalhe inteiro é tela própria no design. Os dois mostram a mesma
 * linha — quando a tela provar que basta, o espia pode sair.
 */
function EspiaDaLinha({
  linha,
  rodada,
  podeDecidir,
  detalhe,
  onJustificar,
  onDesfazer,
  onFechar,
}: {
  linha: LinhaComparacao;
  /** A rodada das linhas na tela: diz se uma conferência ainda vale. */
  rodada: number;
  /** Há onde gravar a decisão, e a rodada é a que vale. */
  podeDecidir: boolean;
  detalhe: string;
  /** Devolvem o motivo de não ter gravado, ou null. */
  onJustificar: (texto: string) => Promise<string | null>;
  onDesfazer: () => Promise<string | null>;
  onFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // quem estava com o foco antes de a janela abrir, lido uma vez só: o React de
  // desenvolvimento roda o efeito duas vezes, e na segunda o foco já está dentro dela
  const quemAbriu = useRef<Element | null>(null);
  const idTitulo = useId();
  const idCampo = useId();
  const idAviso = useId();
  const idErro = useId();
  const situacao = situacaoDaLinha(linha, rodada);
  const [texto, setTexto] = useState("");
  const [emBranco, setEmBranco] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const mensagem = emBranco ? "Escreva o motivo da justificativa." : erro;

  useEffect(() => {
    const elemento = dialogo.current;
    quemAbriu.current ??= document.activeElement;
    if (elemento && !elemento.open) {
      // sem showModal (navegador antigo, jsdom), só abre
      if (typeof elemento.showModal === "function") elemento.showModal();
      else elemento.setAttribute("open", "");
      // o foco vai ao Fechar, e não ao primeiro botão: ele pode ser o "Desfazer justificativa"
      elemento.querySelector<HTMLElement>(".dialog-actions button")?.focus();
    }
    return () => {
      const alvo = quemAbriu.current;
      if (alvo instanceof HTMLElement) alvo.focus();
    };
  }, []);

  /** Uma gravação por vez; o texto fica no campo se ela falhar. */
  async function enviar(acao: () => Promise<string | null>): Promise<string | null> {
    setEnviando(true);
    setErro(null);
    const falha = await acao();
    setEnviando(false);
    setErro(falha);
    return falha;
  }

  async function justificar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const motivo = texto.trim();
    // o motivo é o que fica no registro: sem ele, não há o que gravar
    if (!motivo) {
      setEmBranco(true);
      return;
    }
    if ((await enviar(() => onJustificar(motivo))) === null) setTexto("");
  }

  return (
    <dialog
      ref={dialogo}
      className="espia"
      aria-labelledby={idTitulo}
      // o Esc fecha na hora: o evento close chega depois, e só quando o navegador
      // redesenha a tela; ele fica para o que fechar a janela por outro caminho
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        evento.preventDefault();
        onFechar();
      }}
      onClose={onFechar}
      // o clique no fundo escuro cai no próprio <dialog>; dentro da caixa, num filho
      onClick={(evento) => evento.target === evento.currentTarget && onFechar()}
    >
      <div className="dialog">
        <span id={idTitulo} className="dialog-title">
          {linha.descricao}
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div className="rotulo-origem">
              <IconeOrigem origem="banco" tamanho={14} />
              Extrato do banco
            </div>
            <div className="font-titulo" style={{ fontSize: 24, fontWeight: 600 }}>
              {linha.valorBanco !== null ? formatarMoeda(linha.valorBanco) : "—"}
            </div>
          </div>
          <div>
            <div className="rotulo-origem">
              <IconeOrigem origem="sistema" tamanho={14} />
              Extrato do sistema
            </div>
            <div className="font-titulo" style={{ fontSize: 24, fontWeight: 600 }}>
              {linha.valorSistema !== null ? formatarMoeda(linha.valorSistema) : "—"}
            </div>
          </div>
        </div>
        {linha.explicacao && (
          <div>
            {/* os Termos prometem o selo em todo texto escrito pela IA */}
            {linha.explicacaoPorIa && <SeloIa />}
            <p className="dialog-body">{linha.explicacao}</p>
          </div>
        )}
        {/* a justificativa feita se lê em qualquer rodada; desfazer, só na que vale */}
        {situacao === "justificada" && linha.decisao && (
          <div className="espia-decisao">
            <strong>{`Justificada por ${linha.decisao.autor} em ${formatarDataHora(linha.decisao.em)}`}</strong>
            {linha.decisao.texto && <p className="dialog-body">{linha.decisao.texto}</p>}
            {podeDecidir && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={enviando}
                aria-busy={enviando || undefined}
                onClick={() => enviar(onDesfazer)}
              >
                Desfazer justificativa
              </button>
            )}
            {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
          </div>
        )}
        {podeDecidir && (situacao === "a_conferir" || situacao === "conferida") && (
          <form className="espia-decisao" onSubmit={justificar} noValidate>
            <div className="field">
              <label htmlFor={idCampo}>Justificativa</label>
              <textarea
                id={idCampo}
                className="input"
                rows={3}
                value={texto}
                disabled={enviando}
                aria-invalid={emBranco || undefined}
                aria-describedby={mensagem ? `${idAviso} ${idErro}` : idAviso}
                onChange={(evento) => {
                  setTexto(evento.target.value);
                  if (evento.target.value.trim()) setEmBranco(false);
                }}
              />
            </div>
            <p id={idAviso} className="espia-aviso">
              Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro.
            </p>
            {mensagem && <MensagemErro id={idErro}>{mensagem}</MensagemErro>}
            <button type="submit" className="btn btn-secondary" disabled={enviando} aria-busy={enviando || undefined}>
              Justificar
            </button>
          </form>
        )}
        {/* o backend não registra eventos por lançamento: sem evento, sem tabela vazia */}
        {linha.historico.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Evento</th>
              </tr>
            </thead>
            <tbody>
              {linha.historico.map((evento) => (
                <tr key={`${evento.quando}-${evento.evento}`}>
                  <td>{evento.quando}</td>
                  <td>{evento.evento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onFechar}>
            Fechar
          </button>
          <Link href={detalhe} className="btn btn-primary">
            Abrir detalhe
          </Link>
        </div>
      </div>
    </dialog>
  );
}

function Fechamento({
  conciliacao,
  onNovaConciliacao,
}: {
  conciliacao: Conciliacao;
  onNovaConciliacao: () => void;
}) {
  const total = conciliacao.linhas.length;
  const batidos = conciliacao.linhas.filter((linha) => estaResolvida(linha.status)).length;
  const pendentes = total - batidos;

  return (
    <div style={{ padding: "44px 0 64px", display: "flex", flexDirection: "column", gap: 34 }}>
      <div>
        <div className="rotulo" style={{ marginBottom: 14 }}>
          Mês conciliado
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 42, fontWeight: 400 }}>
          {pendentes === 0
            ? `${conciliacao.mes} fechou sem divergência pendente.`
            : `${conciliacao.mes} fechado com ${pendentes} ${pendentes === 1 ? "item revisado" : "itens revisados"}.`}
        </h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          borderTop: "1px solid var(--color-divider)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ padding: "18px 0" }}>
          <span className="rotulo" style={{ display: "block" }}>Lançamentos</span>
          <span className="font-titulo" style={{ fontSize: 34 }}>{total}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span className="rotulo" style={{ display: "block" }}>
            Batidos automaticamente
          </span>
          <span className="font-titulo" style={{ fontSize: 34 }}>{batidos}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span className="rotulo" style={{ display: "block" }}>
            Revisados manualmente
          </span>
          <span className="font-titulo" style={{ fontSize: 34 }}>{pendentes}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNovaConciliacao}
          style={{ fontSize: 15, padding: "12px 22px" }}
        >
          Começar o próximo mês
        </button>
      </div>
    </div>
  );
}

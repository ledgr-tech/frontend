"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ehDivergencia } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import {
  fecharConciliacao,
  formatarMoeda,
  type Conciliacao,
  type LinhaComparacao,
} from "@/lib/mock-data";
import {
  estaResolvida,
  formatarInteiro,
  rotuloCurto,
  seloDoStatus,
  statusDaLinha,
} from "../../dashboard/resumo";
import { FALHA_AO_CARREGAR, useConciliacao } from "../usar-conciliacao";
import { EsqueletoTela } from "../../esqueleto";
import { filtrarLinhas, ordenarLinhas, type Coluna, type Filtro, type Ordem } from "./ordenar";
import { aplicarDensidade, densidadeAtual, type Densidade } from "../../densidade";
import { IconeOrigem, type Origem } from "../../icone-origem";
import { CartaoLancamento, ladosDaLinha, type CartaoAberto } from "./cartao-lancamento";
import { Relatorio } from "./relatorio";
import { larguraDoValor } from "./largura";
import { Reveal } from "@/app/reveal";
import { Cabecalho } from "../../cabecalho";
import { SeloIa } from "../../selo-ia";

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
  const { estado, substituir } = useConciliacao(params.id, sistema);
  const [linhaAberta, setLinhaAberta] = useState<LinhaComparacao | null>(null);
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

  const { conciliacao, real, truncada } = estado;

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

  const emRevisao = filtrarLinhas(conciliacao.linhas, "revisao");
  const larguraValor = larguraDoValor(conciliacao.linhas);
  const categoria = ehDivergencia(filtro) ? filtro : null;
  const ordenadas = ordenarLinhas(filtrarLinhas(conciliacao.linhas, filtro), ordem);
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

  return (
    <div>
      <Cabecalho
        titulo="Comparação direta"
        contexto={[
          // sem data nenhuma, o mês é o "Conciliação" genérico do adaptador
          conciliacao.mes !== "Conciliação" && `competência ${conciliacao.mes.toLowerCase()}`,
          `${formatarInteiro(conciliacao.linhas.length)} ${conciliacao.linhas.length === 1 ? "lançamento" : "lançamentos"}`,
        ]}
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
        {/* desligar uma categoria volta ao "Só revisão": as cinco são o que ele junta */}
        <Reveal>
          <Relatorio
            linhas={conciliacao.linhas}
            ativa={categoria}
            onEscolher={(status) => escolherFiltro(status ?? "revisao")}
          />
        </Reveal>

        {/* uma faixa só de controles, colada na tabela: o filtro à esquerda, a densidade à direita */}
        <Reveal delay={0.08} className="tabela-ferramentas">
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
                </tr>
              </thead>
              <tbody role="rowgroup">
                {visiveis.map((linha) => {
                  const status = statusDaLinha(linha);
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
                  // o cartão sai da célula do status, centrado nela: é o veredito que ele explica
                  const abrirCartao = (tr: Element) =>
                    setCartao({ linha, ancora: (tr.querySelector(".celula-status") ?? tr).getBoundingClientRect() });
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
                        setLinhaAberta(linha);
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
                      data-tom={status.tom}
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
                        <span
                          className={comCartao ? `selo selo-${status.tom}` : "status-batido"}
                          aria-hidden="true"
                        >
                          {rotuloCurto(linha)}
                        </span>
                        <span className="sr-only">{status.rotulo}</span>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {cartao && <CartaoLancamento id={idCartao} aberto={cartao} />}

          {ordenadas.length === 0 && (
            <p className="tabela-vazia">
              {categoria
                ? `Nenhuma linha em “${seloDoStatus(categoria).rotulo}” nesta conciliação.`
                : "Nada em revisão nesta competência: todos os lançamentos bateram."}
            </p>
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
            detalhe={caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId, linhaAberta.id)}
            onFechar={() => setLinhaAberta(null)}
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
  detalhe,
  onFechar,
}: {
  linha: LinhaComparacao;
  detalhe: string;
  onFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // quem estava com o foco antes de a janela abrir, lido uma vez só: o React de
  // desenvolvimento roda o efeito duas vezes, e na segunda o foco já está dentro dela
  const quemAbriu = useRef<Element | null>(null);
  const idTitulo = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    quemAbriu.current ??= document.activeElement;
    if (elemento && !elemento.open) {
      if (typeof elemento.showModal === "function") elemento.showModal();
      else {
        // sem showModal (navegador antigo, jsdom): abre e leva o foco para dentro, como ele faria
        elemento.setAttribute("open", "");
        elemento.querySelector<HTMLElement>("button, a")?.focus();
      }
    }
    return () => {
      const alvo = quemAbriu.current;
      if (alvo instanceof HTMLElement) alvo.focus();
    };
  }, []);

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

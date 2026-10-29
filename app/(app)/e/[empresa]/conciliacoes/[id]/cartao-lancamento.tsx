"use client";

import type { CSSProperties } from "react";
import { parDoOutroLado } from "./par";
import { formatarMoeda, type LinhaComparacao } from "@/lib/mock-data";
import { formatarDataHora, statusDaLinha } from "../../dashboard/resumo";
import { SeloIa } from "../../selo-ia";
import { continuaDivergindo, rotuloComDecisao, situacaoDaLinha } from "./situacao";

export type Lado = { data: string; descricao: string } | null;

/**
 * Data e descrição de cada lado da linha.
 *
 * `data` e `descricao` da linha são a referência — as do banco, ou as do
 * sistema quando o banco não tem o lançamento —, então o lado do banco só
 * existe com valor no banco. O mock guarda uma data e uma descrição só, que
 * valem para os dois lados.
 */
export function ladosDaLinha(linha: LinhaComparacao): { banco: Lado; sistema: Lado } {
  return {
    banco: linha.valorBanco !== null ? { data: linha.data, descricao: linha.descricao } : null,
    sistema:
      linha.valorSistema !== null
        ? { data: linha.dataSistema ?? linha.data, descricao: linha.descricaoSistema ?? linha.descricao }
        : null,
  };
}

/** A linha acesa e onde a célula do status dela estava na tela quando acendeu. */
export type CartaoAberto = { linha: LinhaComparacao; ancora: DOMRect };

// ponytail: a altura do cartão é estimada, não medida. Com a explicação ele tem
// uns 300px, e a barra do topo (78px) passa por cima dele; com menos que isso de
// espaço acima da linha, ele abre embaixo. Medir entra se algum sair cortado.
const ESPACO_ACIMA = 420;
/** A largura do cartão (a mesma do CSS) e a folga mínima até a borda da tela. */
const LARGURA = 440;
const MARGEM = 16;
/** Entre o cartão e a linha: o espaço da seta que aponta para o status. */
const VAO = 10;

function valorDoLado(lado: Lado, valor: number | null): string {
  return lado && valor !== null ? `${lado.data} · ${formatarMoeda(valor)}` : "—";
}

/** A decisão sobre a linha, quando há o que dizer dela no cartão. */
type NotaDoCartao = { titulo: string; texto: string | null };

function notaDaLinha(linha: LinhaComparacao, rodada: number): NotaDoCartao | null {
  const decisao = linha.decisao;
  if (!decisao) return null;
  const situacao = situacaoDaLinha(linha, rodada);
  if (situacao === "justificada" || situacao === "aguardando") {
    const quando = `Justificada por ${decisao.autor} em ${formatarDataHora(decisao.em)}`;
    // a que espera aprovação ainda segura o fechamento do mês (backend #132)
    return { titulo: situacao === "aguardando" ? `${quando} · aguardando aprovação` : quando, texto: decisao.texto };
  }
  if (continuaDivergindo(linha, rodada)) {
    return {
      titulo: `Conferida na rodada ${decisao.rodada}, continua divergindo depois da nova versão`,
      texto: null,
    };
  }
  return null;
}

/**
 * O miolo do cartão, já em texto. Separado para a vitrine da landing, que
 * mostra o cartão aberto na réplica da tela com os valores dela.
 */
export function ConteudoCartao({
  rotulo,
  titulo,
  banco,
  sistema,
  explicacao,
  geradaPorIa = false,
  descricaoSistema = null,
  diferenca = null,
  nota = null,
}: {
  rotulo: string;
  titulo: string;
  banco: string;
  sistema: string;
  explicacao: string | null;
  /** o nome do lançamento no sistema, inteiro, quando não é o do título: a tabela o corta numa linha */
  descricaoSistema?: string | null;
  /** quanto os dois valores se afastam, na divergência de valor */
  diferenca?: string | null;
  /** a explicação veio da IA: ganha o selo, colado ao texto */
  geradaPorIa?: boolean;
  /** quem justificou e por quê, ou a conferência que a versão nova não resolveu */
  nota?: NotaDoCartao | null;
}) {
  return (
    <>
      <div>
        <h6>Lançamento · {rotulo}</h6>
        <div className="cartao-lancamento-titulo">{titulo}</div>
        <dl>
          <div>
            <dt>Extrato do banco</dt>
            <dd>{banco}</dd>
          </div>
          <div>
            <dt>Extrato do sistema</dt>
            <dd>{sistema}</dd>
          </div>
          {descricaoSistema && (
            <div className="cartao-lancamento-texto">
              <dt>Descrição no sistema</dt>
              <dd>{descricaoSistema}</dd>
            </div>
          )}
          {diferenca && (
            <div>
              <dt>Diferença</dt>
              <dd className="cartao-lancamento-diferenca">{diferenca}</dd>
            </div>
          )}
        </dl>
      </div>
      {nota && (
        <div className="cartao-lancamento-nota">
          <strong>{nota.titulo}</strong>
          {nota.texto && <p className="dialog-body">{nota.texto}</p>}
        </div>
      )}
      {explicacao &&
        (geradaPorIa ? (
          <div>
            <SeloIa />
            <p className="dialog-body">{explicacao}</p>
          </div>
        ) : (
          <p className="dialog-body">{explicacao}</p>
        ))}
    </>
  );
}

/**
 * O lançamento no hover, como o de "Por dentro", na landing. Centrado na coluna do status, com a seta apontando para ele: o
 * balão sai do veredito que ele explica. Fixo na tela, e não dentro da tabela,
 * porque a rolagem horizontal da tabela cortaria o cartão da primeira linha.
 */
export function CartaoLancamento({
  id,
  aberto,
  rodada = 1,
  linhas = [],
  onMouseEnter,
  onMouseLeave,
}: {
  id: string;
  aberto: CartaoAberto;
  /** A rodada das linhas na tela: diz se uma conferência ainda vale. */
  rodada?: number;
  /** Todas as linhas da conciliação: o lado que falta numa divergência está numa delas. */
  linhas?: LinhaComparacao[];
  /** O ponteiro entrou no cartão ou saiu dele: dá para ir da linha até ele. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { linha, ancora } = aberto;
  const { banco, sistema } = ladosDaLinha(linha);
  // "Valor diverge" e "Data diverge" chegam com um lado só; o outro é o par que o motor quase casou
  const par = parDoOutroLado(linha, linhas);
  const valorBanco = par?.lado === "banco" ? par.valor : linha.valorBanco;
  const valorSistema = par?.lado === "sistema" ? par.valor : linha.valorSistema;
  const rotulo = statusDaLinha(linha).rotulo;
  const tela = document.documentElement;
  const acima = ancora.top > ESPACO_ACIMA;
  // o meio do cartão no meio da coluna, sem passar da borda da tela; a seta segue a coluna
  const largura = Math.min(LARGURA, tela.clientWidth - 2 * MARGEM);
  const centro = ancora.left + ancora.width / 2;
  const esquerda = Math.max(MARGEM, Math.min(centro - largura / 2, tela.clientWidth - largura - MARGEM));
  const estilo: CSSProperties & { "--seta-x": string } = {
    left: esquerda,
    "--seta-x": `${centro - esquerda}px`,
    ...(acima ? { bottom: tela.clientHeight - ancora.top + VAO } : { top: ancora.bottom + VAO }),
  };

  return (
    <div
      id={id}
      role="tooltip"
      className="cartao-lancamento cartao-no-eixo cartao-alcancavel"
      data-lado={acima ? "acima" : "abaixo"}
      style={estilo}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <ConteudoCartao
        // o status do motor não muda com a justificativa: ela vem junto, não no lugar dele
        rotulo={rotuloComDecisao(rotulo, situacaoDaLinha(linha, rodada))}
        nota={notaDaLinha(linha, rodada)}
        titulo={linha.descricao}
        banco={par?.lado === "banco" ? `${par.data} · ${formatarMoeda(par.valor)}` : valorDoLado(banco, linha.valorBanco)}
        sistema={par?.lado === "sistema" ? `${par.data} · ${formatarMoeda(par.valor)}` : valorDoLado(sistema, linha.valorSistema)}
        explicacao={linha.explicacao}
        geradaPorIa={linha.explicacaoPorIa}
        descricaoSistema={sistema && sistema.descricao !== linha.descricao ? sistema.descricao : null}
        diferenca={
          // "R$ 15,32 × R$ 15,31" se lê mal; "Diferença: R$ 0,01" diz o tamanho do problema
          linha.status === "divergente_valor" && valorBanco !== null && valorSistema !== null
            ? formatarMoeda(Math.abs(valorBanco - valorSistema))
            : null
        }
      />
    </div>
  );
}

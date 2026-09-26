"use client";

import { formatarMoeda, type LinhaComparacao } from "@/lib/mock-data";
import { statusDaLinha } from "../../dashboard/resumo";

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

/** A linha acesa e onde ela estava na tela quando acendeu. */
export type CartaoAberto = { linha: LinhaComparacao; ancora: DOMRect };

// ponytail: a altura do cartão é estimada, não medida. Com menos que isso de
// espaço acima da linha, ele abre embaixo; medir entra se algum sair cortado.
const ESPACO_ACIMA = 240;

function valorDoLado(lado: Lado, valor: number | null): string {
  return lado && valor !== null ? `${lado.data} · ${formatarMoeda(valor)}` : "—";
}

/**
 * O lançamento no hover, como o da landing ("duas telas abertas, um dedo em
 * cada linha"). Fixo na tela, e não dentro da tabela, porque a rolagem
 * horizontal da tabela cortaria o cartão da primeira linha.
 */
export function CartaoLancamento({ id, aberto }: { id: string; aberto: CartaoAberto }) {
  const { linha, ancora } = aberto;
  const { banco, sistema } = ladosDaLinha(linha);
  const tela = document.documentElement;
  const acima = ancora.top > ESPACO_ACIMA;

  return (
    <div
      id={id}
      role="tooltip"
      className="cartao-lancamento"
      style={{
        right: tela.clientWidth - ancora.right + 12,
        ...(acima ? { bottom: tela.clientHeight - ancora.top - 4 } : { top: ancora.bottom - 4 }),
      }}
    >
      <div>
        <h6>Lançamento · {statusDaLinha(linha).rotulo}</h6>
        <div className="cartao-lancamento-titulo">{linha.descricao}</div>
        <dl>
          <div>
            <dt>Extrato do banco</dt>
            <dd>{valorDoLado(banco, linha.valorBanco)}</dd>
          </div>
          <div>
            <dt>Extrato do sistema</dt>
            <dd>{valorDoLado(sistema, linha.valorSistema)}</dd>
          </div>
        </dl>
      </div>
      {linha.explicacao && <p className="dialog-body">{linha.explicacao}</p>}
    </div>
  );
}

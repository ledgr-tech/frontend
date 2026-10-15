import Image from "next/image";
import Link from "next/link";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { ListaDeConciliacoes } from "../conciliacoes/acoes";
import { tituloDaCompetencia } from "../fechamentos/fechamento";
import { formatarInteiro } from "./resumo";
import type { ConciliacaoNaLista } from "./lista";

/** "9 linhas pedem decisão · 3 de 9 conferidas · rodada 2 de 2": o que falta e onde a pessoa estava. */
function fraseDoAndamento(contagem: NonNullable<ListaDeConciliacoes["emAndamento"]>, conciliacao: ConciliacaoNaLista) {
  const { pedemDecisao, conferidas } = contagem;
  return [
    `${formatarInteiro(pedemDecisao)} ${pedemDecisao === 1 ? "linha pede" : "linhas pedem"} decisão`,
    conferidas !== null && `${formatarInteiro(conferidas)} de ${formatarInteiro(pedemDecisao)} conferidas`,
    conciliacao.rodadas > 1 ? `rodada ${conciliacao.rodada} de ${conciliacao.rodadas}` : `rodada ${conciliacao.rodada}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "Continue de onde parou": a primeira da fila que ainda pede decisão, numa faixa de uma linha
 * (revisão de estilo de 15/10). O cartão grande que estava aqui repetia a primeira linha da lista;
 * a faixa só leva de volta à comparação. Sem nada pendente, ela não aparece.
 */
export function ContinueDeOndeParou({
  conciliacao,
  contagem,
}: {
  conciliacao: ConciliacaoNaLista;
  contagem: NonNullable<ListaDeConciliacoes["emAndamento"]>;
}) {
  const { extratoBancoId, arquivoBanco, arquivoSistema, competencia } = conciliacao;
  return (
    <section className="conc-continuar" aria-labelledby="conc-continuar-titulo">
      <Image
        src="/mascotes/mascote-caminhando.png"
        alt=""
        width={1152}
        height={1125}
        sizes="48px"
        className="conc-continuar-mascote"
      />
      <div className="conc-continuar-corpo">
        <span id="conc-continuar-titulo" className="rotulo">
          Continue de onde parou
        </span>
        <span className="conc-continuar-titulo">
          {tituloDaCompetencia(competencia)}
          <span className="conc-continuar-arquivos">{` · ${arquivoBanco} × ${arquivoSistema}`}</span>
        </span>
        <span className="conc-continuar-texto">{fraseDoAndamento(contagem, conciliacao)}</span>
      </div>
      {/* pelo endereço só do banco, que abre a rodada que vale */}
      <Link href={caminhoDaConciliacao(extratoBancoId)} className="btn btn-primary">
        Continuar
      </Link>
    </section>
  );
}

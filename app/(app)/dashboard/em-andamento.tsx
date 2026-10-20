import Image from "next/image";
import Link from "next/link";
import { caminhoDaConciliacao, caminhoDoFechamento } from "@/lib/caminhos";
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
    <section className="conc-continuar" aria-labelledby="conc-continuar-titulo" data-tutorial="continuar">
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

/**
 * O "Agora" de Conciliações, na coluna da direita: com pendência, o "Continue de onde parou"; sem ela,
 * o mês pronto para fechar (o mesmo critério do link da lista) ou, não havendo, uma conciliação nova.
 */
export function AgoraDeConciliacoes({
  emAndamento,
  prontoParaFechar,
}: {
  emAndamento: { conciliacao: ConciliacaoNaLista; contagem: NonNullable<ListaDeConciliacoes["emAndamento"]> } | null;
  prontoParaFechar: { competencia: string; titulo: string } | null;
}) {
  if (emAndamento) return <ContinueDeOndeParou conciliacao={emAndamento.conciliacao} contagem={emAndamento.contagem} />;
  return (
    <div className="conc-continuar">
      {prontoParaFechar ? (
        <Link href={caminhoDoFechamento(prontoParaFechar.competencia)} className="btn btn-primary">
          {`Fechamento de ${prontoParaFechar.titulo.split(" ")[0].toLowerCase()}`}
        </Link>
      ) : (
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Nova conciliação
        </Link>
      )}
    </div>
  );
}

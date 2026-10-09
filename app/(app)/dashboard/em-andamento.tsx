import Image from "next/image";
import Link from "next/link";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { SpotlightHover } from "@/app/reveal";
import type { ListaDeConciliacoes } from "../conciliacoes/acoes";
import { tituloDaCompetencia } from "../fechamentos/fechamento";
import { BarraDoResultado, QuadradosDasRodadas } from "../historico/por-conciliacao";
import { formatarDataHora, formatarInteiro } from "./resumo";
import type { ConciliacaoNaLista } from "./lista";

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

/** "12 batem · 9 pedem decisão · 3 de 9 conferidas · 1 justificada": o que já foi feito e o que falta. */
function fraseDoAndamento(contagem: NonNullable<ListaDeConciliacoes["emAndamento"]>): string {
  return [
    `${formatarInteiro(contagem.batem)} ${contagem.batem === 1 ? "bate" : "batem"}`,
    `${formatarInteiro(contagem.pedemDecisao)} ${contagem.pedemDecisao === 1 ? "pede" : "pedem"} decisão`,
    contagem.conferidas !== null &&
      `${formatarInteiro(contagem.conferidas)} de ${plural(contagem.pedemDecisao, "conferida", "conferidas")}`,
    contagem.justificadas > 0 && plural(contagem.justificadas, "justificada", "justificadas"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * O topo da lista de trabalho: a primeira da fila que ainda pede decisão, com o que falta nela e o
 * caminho de volta para a comparação; sem nenhuma, a mais recente, para dizer que está tudo decidido.
 * O mascote apontando segue o cartão de destaque que a tela já tinha.
 */
export function EmAndamento({
  conciliacao,
  contagem,
}: {
  conciliacao: ConciliacaoNaLista;
  /** Null quando nada pede decisão: aí `conciliacao` é a mais recente. */
  contagem: ListaDeConciliacoes["emAndamento"];
}) {
  const { extratoBancoId, arquivoBanco, arquivoSistema, competencia, rodada, rodadas, execucao } = conciliacao;
  const mes = tituloDaCompetencia(competencia).toLowerCase();
  return (
    <section className="conc-andamento" aria-labelledby="conc-andamento-titulo">
      <h6 id="conc-andamento-titulo" className="conc-andamento-rotulo">
        Em andamento
      </h6>
      <SpotlightHover className="dash-destaque dash-destaque-faixa">
        <Image
          src="/mascotes/mascote-caminhando.png"
          alt=""
          width={1152}
          height={1125}
          sizes="88px"
          className="conc-andamento-mascote"
        />
        {contagem ? (
          <span className="dash-destaque-corpo">
            <span className="dash-destaque-titulo">{arquivoBanco}</span>
            <span className="dash-destaque-texto">{`${arquivoSistema} · ${mes}`}</span>
            <span className="conc-andamento-rodada">
              <QuadradosDasRodadas rodada={rodada} rodadas={rodadas} />
              {`Rodada ${rodada} de ${rodadas} · ${formatarDataHora(execucao.executadaEm)}`}
            </span>
            {execucao.lancamentos > 0 && <BarraDoResultado execucao={execucao} />}
            <span className="dash-destaque-texto conc-andamento-frase">{fraseDoAndamento(contagem)}</span>
          </span>
        ) : (
          <span className="dash-destaque-corpo">
            <span className="dash-destaque-titulo">Nenhuma conciliação pede decisão.</span>
            <span className="dash-destaque-texto">{`A mais recente é ${arquivoBanco}, de ${mes}, sem pendência.`}</span>
          </span>
        )}
        {/* pelo endereço só do banco, que abre a rodada que vale */}
        <Link
          href={caminhoDaConciliacao(extratoBancoId)}
          className={contagem ? "btn btn-primary" : "btn btn-secondary"}
        >
          {contagem ? "Continuar na comparação" : "Ver a comparação"}
        </Link>
      </SpotlightHover>
    </section>
  );
}

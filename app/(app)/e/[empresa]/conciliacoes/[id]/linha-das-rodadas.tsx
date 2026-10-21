import type { CSSProperties } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { caminhoDaConciliacao, caminhoDoFechamento } from "@/lib/caminhos";
import { formatarDataHora, formatarInteiro } from "../../dashboard/resumo";
import type { RodadaVista } from "../acoes";

/** "Rodada 1 · erp-setembro.csv, 23/09/2026 14:02": o nome de cada passo da linha. */
function nomeDaRodada(rodada: RodadaVista): string {
  return `Rodada ${rodada.numero} · ${rodada.arquivoSistema}, ${formatarDataHora(rodada.executadaEm)}`;
}

/** O fio em onda entre dois passos; `ordem` atrasa o desenho, para ele correr da esquerda para a direita. */
function Fio({ ordem, falta = false }: { ordem: number; falta?: boolean }) {
  return (
    <span
      className="rodadas-fio"
      data-falta={falta || undefined}
      aria-hidden="true"
      style={{ "--ordem": ordem } as CSSProperties}
    />
  );
}

/**
 * A linha das rodadas, na faixa da rodada: um quadrado por extrato do sistema conciliado
 * com este extrato do banco, ligados pelo fio em onda da landing, que se desenha ao abrir
 * a tela. As outras rodadas são links; a aberta é onde a pessoa está. No fim, a chegada:
 * o fechamento do mês, com o que ainda falta para ele.
 */
export function LinhaDasRodadas({
  extratoBancoId,
  rodadas,
  aberta,
  mes,
  pendentes,
}: {
  extratoBancoId: string;
  /** Da primeira à mais recente. */
  rodadas: RodadaVista[];
  /** O número da rodada na tela. */
  aberta: number;
  /** A competência (AAAA-MM) do fechamento a que a linha chega. */
  mes: string;
  /** O que ainda pede decisão na rodada que vale; null numa rodada passada, que não conta. */
  pendentes: number | null;
}) {
  const ultima = rodadas.length;
  return (
    <nav className="rodadas-linha" aria-label="Rodadas desta conciliação">
      <ol>
        {rodadas.map((rodada, indice) => (
          <li key={rodada.numero}>
            {indice > 0 && <Fio ordem={indice} />}
            {rodada.numero === aberta ? (
              <span className="rodadas-quadrado" aria-current="step" title={nomeDaRodada(rodada)}>
                <span aria-hidden="true">{rodada.numero}</span>
                <span className="sr-only">{nomeDaRodada(rodada)}</span>
              </span>
            ) : (
              <Link
                className="rodadas-quadrado"
                // a mais recente pelo endereço só do banco, como o "ver a mais recente"
                href={
                  rodada.numero === ultima
                    ? caminhoDaConciliacao(extratoBancoId)
                    : caminhoDaConciliacao(extratoBancoId, rodada.extratoSistemaId)
                }
                aria-label={nomeDaRodada(rodada)}
                title={nomeDaRodada(rodada)}
              >
                {rodada.numero}
              </Link>
            )}
          </li>
        ))}
        <li>
          {/* o trecho até a chegada fica tracejado enquanto alguma linha pede decisão */}
          <Fio ordem={rodadas.length} falta={pendentes !== 0} />
          <Link className="rodadas-chegada" href={caminhoDoFechamento(mes)} data-pronto={pendentes === 0 || undefined}>
            <Flag size={15} aria-hidden="true" />
            {pendentes === null ? (
              <span className="sr-only">Fechamento</span>
            ) : (
              <>
                <span className="sr-only">Fechamento: </span>
                {pendentes === 0
                  ? "pronto para fechar"
                  : `${pendentes === 1 ? "falta" : "faltam"} ${formatarInteiro(pendentes)}`}
              </>
            )}
          </Link>
        </li>
      </ol>
    </nav>
  );
}

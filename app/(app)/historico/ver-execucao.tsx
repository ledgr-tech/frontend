import Link from "next/link";
import type { Execucao } from "@/lib/adaptadores";
import { caminhoDaConciliacao } from "@/lib/caminhos";

/**
 * Nota para quando a lista tem alguma rodada refeita. O backend guarda só a
 * rodada mais nova de cada par, então o link de uma rodada antiga abre a atual:
 * as contagens da linha são da época, o que abre não.
 */
export const NOTA_VER_ATUAL =
  "Ver atual: o mesmo par de arquivos foi conciliado de novo depois. Só o resultado mais recente fica guardado, e é ele que abre.";

/** O link de uma execução, no histórico e na atividade recente da visão geral. */
export function VerExecucao({ execucao }: { execucao: Execucao }) {
  return (
    <Link
      href={caminhoDaConciliacao(execucao.extratoBancoId, execucao.extratoSistemaId)}
      className="btn btn-secondary"
      style={{ whiteSpace: "nowrap" }}
    >
      {execucao.atual ? "Ver" : "Ver atual"}
    </Link>
  );
}

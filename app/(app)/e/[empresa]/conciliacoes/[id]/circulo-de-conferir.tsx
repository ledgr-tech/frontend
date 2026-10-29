import { Check, RotateCw } from "lucide-react";
import type { LinhaComparacao } from "@/lib/mock-data";

/**
 * A conferência de uma linha, na coluna dela no fim da linha. Um círculo, e não um quadrado,
 * para não parecer "selecionar a linha": vazio a conferir, preenchido com ✓ quando conferida, e
 * com o ↻ dourado quando foi conferida numa rodada passada e a versão nova não resolveu.
 */
export function CirculoDeConferir({
  linha,
  conferida,
  voltou,
  onConferir,
}: {
  linha: LinhaComparacao;
  conferida: boolean;
  /** Conferida numa rodada anterior e ainda divergindo nesta. */
  voltou: boolean;
  onConferir: () => void;
}) {
  const dica = conferida
    ? "Conferida · desmarcar"
    : voltou
      ? `Conferida na rodada ${linha.decisao?.rodada}, continua divergindo`
      : "Marcar como conferida";
  return (
    <>
      <button
        type="button"
        className="conferir-circulo"
        aria-pressed={conferida}
        aria-label={`Marcar ${linha.descricao} como conferida`}
        title={dica}
        data-voltou={voltou || undefined}
        onClick={onConferir}
      >
        {conferida ? <Check size={13} aria-hidden="true" /> : voltou && <RotateCw size={12} aria-hidden="true" />}
      </button>
      {voltou && (
        <span className="sr-only">
          {`Conferida na rodada ${linha.decisao?.rodada}, continua divergindo depois da nova versão`}
        </span>
      )}
    </>
  );
}

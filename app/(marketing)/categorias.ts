import { seloDoStatus } from "@/app/(app)/dashboard/resumo";
import { DIVERGENCIAS } from "@/lib/adaptadores";

// As categorias de divergência do motor, na ordem e com os nomes do relatório
// do app: o site não pode prometer uma lista e o produto entregar outra.
export const CATEGORIAS = new Intl.ListFormat("pt-BR").format(
  DIVERGENCIAS.map((status) => seloDoStatus(status).rotulo.toLowerCase()),
);

const DE_TRES_A_DEZ = ["Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez"];
const POR_EXTENSO = {
  f: ["Nenhuma", "Uma", "Duas", ...DE_TRES_A_DEZ],
  m: ["Nenhum", "Um", "Dois", ...DE_TRES_A_DEZ],
};

/** Um número por extenso e com maiúscula ("Cinco"), para abrir uma frase; acima de dez, o algarismo. */
export function porExtenso(n: number, genero: "f" | "m"): string {
  return POR_EXTENSO[genero][n] ?? String(n);
}

/** Quantas categorias o motor tem, no feminino, como "categorias"; o número vem do motor (DIVERGENCIAS). */
export const QUANTAS_CATEGORIAS = porExtenso(DIVERGENCIAS.length, "f");

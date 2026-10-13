import { seloDoStatus } from "@/app/(app)/dashboard/resumo";
import { DIVERGENCIAS } from "@/lib/adaptadores";

// As categorias de divergência do motor, na ordem e com os nomes do relatório
// do app: o site não pode prometer uma lista e o produto entregar outra.
export const CATEGORIAS = new Intl.ListFormat("pt-BR").format(
  DIVERGENCIAS.map((status) => seloDoStatus(status).rotulo.toLowerCase()),
);

// No feminino, como "categorias"; o número em si continua vindo do motor (DIVERGENCIAS).
const POR_EXTENSO = ["Nenhuma", "Uma", "Duas", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez"];

/** Quantas categorias o motor tem, por extenso e com maiúscula ("Cinco"), para abrir uma frase. */
export const QUANTAS_CATEGORIAS = POR_EXTENSO[DIVERGENCIAS.length] ?? String(DIVERGENCIAS.length);

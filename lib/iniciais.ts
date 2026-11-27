// por grafema: uma bandeira, um emoji com ZWJ ou um acento combinado contam como uma letra só
const grafemas = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("pt-BR", { granularity: "grapheme" }) : null;

function primeiraLetra(palavra: string): string {
  if (!grafemas) return Array.from(palavra)[0] ?? "";
  return grafemas.segment(palavra)[Symbol.iterator]().next().value?.segment ?? "";
}

/**
 * As iniciais de uma pessoa: a primeira letra das duas primeiras palavras do nome, em maiúscula
 * ("Aleksandra Wiśniewska-Kowalczyk" → "AW"). Por grafema, não por unidade UTF-16, para um nome que começa
 * com emoji ou letra acentuada não virar meio caractere.
 */
export function iniciais(nome: string): string {
  return nome
    .normalize("NFC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(primeiraLetra)
    .join("")
    .toUpperCase();
}

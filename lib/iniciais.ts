/**
 * As iniciais de uma pessoa: a primeira letra das duas primeiras palavras do nome, em maiúscula
 * ("Aleksandra Wiśniewska-Kowalczyk" → "AW"). Por letra inteira, não por unidade UTF-16, para um nome
 * que começa com emoji ou letra acentuada composta não virar meio caractere.
 */
export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => Array.from(parte)[0])
    .join("")
    .toUpperCase();
}

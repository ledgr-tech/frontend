/** As 27 siglas que o backend aceita (#184). Fora de `acoes.ts`: um arquivo "use server" só exporta funções assíncronas. */
export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export function ehUf(valor: string): boolean {
  return (UFS as readonly string[]).includes(valor);
}

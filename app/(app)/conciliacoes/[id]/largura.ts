import { formatarMoeda, type LinhaComparacao } from "@/lib/mock-data";

/** Quantos caracteres cabem na coluna de valor de 10rem: "-R$ 1.234.567,89". */
const CABE_NO_PADRAO = 16;

/**
 * A largura da coluna de valor quando o padrão (10rem, globals.css) não basta, ou
 * null. Em conciliação o centavo importa: o valor nunca é abreviado nem encolhido,
 * é a coluna que cresce. Medida sobre a conciliação inteira, e não sobre a página,
 * para a coluna não mudar de largura ao paginar ou filtrar. Cada caractere do valor
 * (Newsreader 17px, algarismos tabulares) mede uns 9,4px; o resto é o respiro da célula.
 */
export function larguraDoValor(linhas: LinhaComparacao[]): string | null {
  // reduce, e não Math.max(...): uma conciliação de dezenas de milhares de linhas estoura o
  // limite de argumentos de alguns navegadores
  const maior = linhas.reduce(
    (atual, { valorBanco, valorSistema }) =>
      Math.max(
        atual,
        valorBanco === null ? 0 : formatarMoeda(valorBanco).length,
        valorSistema === null ? 0 : formatarMoeda(valorSistema).length,
      ),
    0,
  );
  return maior > CABE_NO_PADRAO ? `${(maior * 0.59 + 1.25).toFixed(2)}rem` : null;
}

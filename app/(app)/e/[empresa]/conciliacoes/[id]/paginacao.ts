import type { LinhaComparacao } from "@/lib/mock-data";

const LINHAS_POR_PAGINA = 50;

/** Recebe os membros de cada lote juntos, como saem de juntarGrupos. */
export function paginarLinhas(linhas: readonly LinhaComparacao[]) {
  const paginas: { inicio: number; fim: number }[] = [];
  let inicio = 0;
  while (inicio < linhas.length) {
    const limite = Math.min(inicio + LINHAS_POR_PAGINA, linhas.length);
    const grupo = linhas[limite]?.grupoId;
    let fim = limite;
    if (grupo) {
      // Deixa o lote para a página seguinte. Um lote maior que a página ocupa uma página própria.
      while (fim > inicio && linhas[fim - 1].grupoId === grupo) fim -= 1;
      if (fim === inicio) {
        fim = limite;
        while (linhas[fim]?.grupoId === grupo) fim += 1;
      }
    }
    paginas.push({ inicio, fim });
    inicio = fim;
  }
  return paginas;
}

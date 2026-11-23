import type { LinhaComparacao } from "@/lib/mock-data";
import { chaveDaLinha } from "@/lib/rodadas";
import { centavos, estaResolvida } from "../../dashboard/resumo";

export type SomaDasLinhas = {
  quantidade: number;
  banco: number;
  sistema: number;
  diferenca: number;
};

export function podeSelecionar(linha: LinhaComparacao): boolean {
  return !estaResolvida(linha.status);
}

export function somarLinhas(linhas: readonly LinhaComparacao[]): SomaDasLinhas {
  const soma = linhas.reduce(
    (total, linha) => ({
      banco: total.banco + (linha.valorBanco === null ? 0 : centavos(linha.valorBanco)),
      sistema: total.sistema + (linha.valorSistema === null ? 0 : centavos(linha.valorSistema)),
    }),
    { banco: 0, sistema: 0 },
  );

  return {
    quantidade: linhas.length,
    banco: soma.banco,
    sistema: soma.sistema,
    diferenca: soma.banco - soma.sistema,
  };
}

export function limparSelecao(
  selecionadas: ReadonlySet<string>,
  linhas: readonly LinhaComparacao[],
): string[] {
  return linhas
    .filter(podeSelecionar)
    .map(chaveDaLinha)
    .filter((chave) => selecionadas.has(chave));
}

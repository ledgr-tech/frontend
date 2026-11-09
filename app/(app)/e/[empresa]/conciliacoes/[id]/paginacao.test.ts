import { expect, it } from "vitest";
import type { LinhaComparacao } from "@/lib/mock-data";
import { paginarLinhas } from "./paginacao";

function linhas(quantidade: number, grupoId?: string): LinhaComparacao[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: String(i), descricao: "Pagamento", data: "01/10", valorBanco: 100, valorSistema: 100,
    status: "match_exato", explicacao: null, historico: [], grupoId,
  }));
}

it("mantém inteiro o lote que cruza o limite da página", () => {
  expect(paginarLinhas([...linhas(48), ...linhas(4, "lote"), ...linhas(2)])).toEqual([
    { inicio: 0, fim: 48 },
    { inicio: 48, fim: 54 },
  ]);
});

it("dá ao lote maior que o limite uma página própria e continua a lista", () => {
  expect(paginarLinhas([...linhas(56, "lote"), ...linhas(2)])).toEqual([
    { inicio: 0, fim: 56 },
    { inicio: 56, fim: 58 },
  ]);
});

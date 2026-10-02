import { describe, it, expect } from "vitest";
import type { LinhaComparacao } from "@/lib/mock-data";
import { larguraDoValor } from "./largura";

function linha(valorBanco: number | null, valorSistema: number | null): LinhaComparacao {
  return {
    id: `l-${valorBanco}-${valorSistema}`,
    descricao: "Lançamento",
    data: "04/09",
    valorBanco,
    valorSistema,
    status: "match_exato",
    explicacao: null,
    historico: [],
  };
}

describe("larguraDoValor", () => {
  it("keeps the column at its default width up to the millions", () => {
    expect(larguraDoValor([linha(-12640, -12604), linha(-123456.78, null), linha(null, 0.38)])).toBeNull();
    // "-R$ 1.234.567,89" ainda cabe nos 10rem, comendo a folga da direita
    expect(larguraDoValor([linha(-1234567.89, -1234567.89)])).toBeNull();
  });

  it("widens the column to the largest value of the whole conciliação, never shrinking it", () => {
    // "-R$ 12.345.678,90": 17 caracteres
    expect(larguraDoValor([linha(100, 100), linha(-12345678.9, -12345678.9)])).toBe("11.28rem");
    // "R$ 123.456.789,00": a maior das duas colunas vale para as duas
    expect(larguraDoValor([linha(null, 123456789), linha(-12345678.9, null)])).toBe("11.28rem");
    expect(larguraDoValor([linha(-123456789, null)])).toBe("11.87rem");
  });
});

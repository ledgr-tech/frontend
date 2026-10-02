import { describe, it, expect } from "vitest";
import type { LinhaComparacao } from "./mock-data";
import { chaveDaLinha } from "./rodadas";

function linha(parcial: Partial<LinhaComparacao> = {}): LinhaComparacao {
  return {
    id: "lc-1",
    descricao: "Boleto Aço Norte",
    data: "04/09",
    valorBanco: -12640,
    valorSistema: -12604,
    status: "divergente_valor",
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

describe("chaveDaLinha", () => {
  it("usa a chave da linha, e o id quando ela não tem (o mock)", () => {
    expect(chaveDaLinha(linha({ chave: "b:lb-1" }))).toBe("b:lb-1");
    expect(chaveDaLinha(linha())).toBe("lc-1");
  });
});

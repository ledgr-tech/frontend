import { describe, expect, it } from "vitest";
import type { LinhaComparacao } from "@/lib/mock-data";
import { parDoOutroLado } from "./par";

function linha(parcial: Partial<LinhaComparacao>): LinhaComparacao {
  return {
    id: "l",
    descricao: "Linha",
    data: "06/07",
    dataISO: "2026-07-06",
    valorBanco: null,
    valorSistema: null,
    status: "divergente_valor",
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

// o caso real de julho: o banco e o sistema do fornecedor Gama, cada um numa linha
const BANCO_GAMA = linha({ id: "b", descricao: "BOLETO FORNECEDOR GAMA", valorBanco: -3200 });
const SISTEMA_GAMA = linha({ id: "s", descricao: "Pagamento Fornecedor Gama NF 77", dataSistema: "06/07", valorSistema: -3020 });

describe("parDoOutroLado", () => {
  it("valor diverge: acha o lançamento do outro lado na mesma data", () => {
    expect(parDoOutroLado(BANCO_GAMA, [BANCO_GAMA, SISTEMA_GAMA])).toEqual({
      lado: "sistema",
      data: "06/07",
      descricao: "Pagamento Fornecedor Gama NF 77",
      valor: -3020,
    });
    expect(parDoOutroLado(SISTEMA_GAMA, [BANCO_GAMA, SISTEMA_GAMA])).toEqual({
      lado: "banco",
      data: "06/07",
      descricao: "BOLETO FORNECEDOR GAMA",
      valor: -3200,
    });
  });

  it("com mais de um candidato, fica o de valor mais próximo", () => {
    const longe = linha({ id: "s2", descricao: "Outro", dataSistema: "06/07", valorSistema: -9000 });
    expect(parDoOutroLado(BANCO_GAMA, [BANCO_GAMA, longe, SISTEMA_GAMA])?.valor).toBe(-3020);
  });

  it("não sugere lançamento que já formou par numa linha que bateu", () => {
    const batida = linha({ id: "m", status: "match_exato", valorBanco: -3100, valorSistema: -3100, dataSistema: "06/07" });
    expect(parDoOutroLado(BANCO_GAMA, [BANCO_GAMA, batida])).toBeNull();
  });

  it("não pareia com outra data nem com o mesmo valor (seria outra categoria)", () => {
    const outraData = linha({ id: "s3", dataISO: "2026-07-07", dataSistema: "07/07", valorSistema: -3020 });
    const mesmoValor = linha({ id: "s4", dataSistema: "06/07", valorSistema: -3200 });
    expect(parDoOutroLado(BANCO_GAMA, [BANCO_GAMA, outraData, mesmoValor])).toBeNull();
  });

  it("data diverge: acha o mesmo valor em outra data, a mais próxima", () => {
    const banco = linha({ id: "b", status: "divergente_data", dataISO: "2026-07-09", data: "09/07", valorBanco: -890 });
    const perto = linha({ id: "s", status: "divergente_data", dataISO: "2026-07-17", dataSistema: "17/07", descricao: "Frete", valorSistema: -890 });
    const longe = linha({ id: "s2", status: "divergente_data", dataISO: "2026-07-30", dataSistema: "30/07", valorSistema: -890 });
    expect(parDoOutroLado(banco, [banco, longe, perto])).toEqual({ lado: "sistema", data: "17/07", descricao: "Frete", valor: -890 });
  });

  it("as outras categorias não têm par", () => {
    const tarifa = linha({ status: "tarifa_bancaria", valorBanco: -45 });
    expect(parDoOutroLado(tarifa, [tarifa, SISTEMA_GAMA])).toBeNull();
  });
});

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { guardarLocal, juntar, preferenciasLocais, PREFERENCIAS_VAZIAS } from "./preferencias";

describe("preferências no navegador", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("começa vazia", () => {
    expect(preferenciasLocais()).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("guarda e lê de volta", () => {
    guardarLocal({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
    expect(preferenciasLocais()).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
  });

  it("ignora o que não é uma tela conhecida e o JSON quebrado", () => {
    window.localStorage.setItem(
      "ledgr:preferencias",
      '{"tutoriaisDispensados":["extratos","xyz"],"roteiroDispensado":"sim"}',
    );
    expect(preferenciasLocais()).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false });
    window.localStorage.setItem("ledgr:preferencias", "{quebrado");
    expect(preferenciasLocais()).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("sem localStorage, lê vazio e guardar não lança", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(preferenciasLocais()).toEqual(PREFERENCIAS_VAZIAS);
    expect(() => guardarLocal({ tutoriaisDispensados: ["historico"], roteiroDispensado: false })).not.toThrow();
  });

  it("junta as duas fontes sem repetir", () => {
    expect(
      juntar(
        { tutoriaisDispensados: ["extratos"], roteiroDispensado: false },
        { tutoriaisDispensados: ["extratos", "historico"], roteiroDispensado: true },
      ),
    ).toEqual({ tutoriaisDispensados: ["extratos", "historico"], roteiroDispensado: true });
  });
});

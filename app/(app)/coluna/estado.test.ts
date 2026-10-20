import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CHAVE_COLUNA, colunaRecolhida, definirColuna, temColuna } from "./estado";

describe("estado da coluna", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.coluna;
    window.localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("temColuna vale para as sete telas e não para divergência, configurações e null", () => {
    for (const t of ["visao-geral", "conciliacoes", "nova-conciliacao", "comparacao", "extratos", "historico", "fechamentos"] as const) {
      expect(temColuna(t)).toBe(true);
    }
    expect(temColuna("divergencia")).toBe(false);
    expect(temColuna("configuracoes")).toBe(false);
    expect(temColuna(null)).toBe(false);
  });

  it("definirColuna(true) põe o atributo e grava", () => {
    definirColuna(true);
    expect(document.documentElement.dataset.coluna).toBe("recolhida");
    expect(window.localStorage.getItem(CHAVE_COLUNA)).toBe("recolhida");
    expect(colunaRecolhida()).toBe(true);
  });

  it("sem gravar, muda o atributo e não toca o localStorage", () => {
    definirColuna(false, { gravar: false });
    expect(document.documentElement.dataset.coluna).toBe("aberta");
    expect(window.localStorage.getItem(CHAVE_COLUNA)).toBeNull();
  });

  it("com o localStorage bloqueado, o atributo muda mesmo assim", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => definirColuna(true)).not.toThrow();
    expect(colunaRecolhida()).toBe(true);
  });
});

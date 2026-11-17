import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { guardarLocal, juntar, preferenciasLocais, PREFERENCIAS_VAZIAS, type Preferencias } from "./preferencias";

const EMAIL = "ana@example.com";
const CHAVE_DA_ANA = `ledgr:preferencias:${EMAIL}`;

describe("preferências no navegador", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("começa vazia", () => {
    expect(preferenciasLocais(EMAIL)).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("guarda e lê apenas para o mesmo e-mail, independentemente de maiúsculas", () => {
    const dispensadas: Preferencias = { tutoriaisDispensados: ["extratos"], roteiroDispensado: true, boasVindasVista: false };
    guardarLocal(EMAIL.toUpperCase(), dispensadas);
    expect(JSON.parse(window.localStorage.getItem(CHAVE_DA_ANA)!)).toEqual(dispensadas);
    expect(preferenciasLocais(EMAIL)).toEqual(dispensadas);
    expect(preferenciasLocais("bia@example.com")).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("ignora e apaga a chave antiga sem dono", () => {
    window.localStorage.setItem("ledgr:preferencias", '{"tutoriaisDispensados":["extratos"],"roteiroDispensado":true}');
    expect(preferenciasLocais(EMAIL)).toEqual(PREFERENCIAS_VAZIAS);
    expect(window.localStorage.length).toBe(0);
  });

  it("sem e-mail, não acessa o armazenamento", () => {
    const ler = vi.spyOn(Storage.prototype, "getItem");
    const guardar = vi.spyOn(Storage.prototype, "setItem");
    const apagar = vi.spyOn(Storage.prototype, "removeItem");
    expect(preferenciasLocais("")).toEqual(PREFERENCIAS_VAZIAS);
    guardarLocal("", { tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
    expect(ler).not.toHaveBeenCalled();
    expect(guardar).not.toHaveBeenCalled();
    expect(apagar).not.toHaveBeenCalled();
  });

  it("ignora o que não é uma tela conhecida e o JSON quebrado", () => {
    window.localStorage.setItem(
      CHAVE_DA_ANA,
      '{"tutoriaisDispensados":["extratos","xyz"],"roteiroDispensado":"sim"}',
    );
    expect(preferenciasLocais(EMAIL)).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false, boasVindasVista: false });
    window.localStorage.setItem(CHAVE_DA_ANA, "{quebrado");
    expect(preferenciasLocais(EMAIL)).toEqual(PREFERENCIAS_VAZIAS);
  });

  it("sem localStorage, lê vazio e guardar não lança", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(preferenciasLocais(EMAIL)).toEqual(PREFERENCIAS_VAZIAS);
    expect(() => guardarLocal(EMAIL, { tutoriaisDispensados: ["historico"], roteiroDispensado: false })).not.toThrow();
  });

  it("junta as duas fontes sem repetir", () => {
    expect(
      juntar(
        { tutoriaisDispensados: ["extratos"], roteiroDispensado: false },
        { tutoriaisDispensados: ["extratos", "historico"], roteiroDispensado: true },
      ),
    ).toEqual({ tutoriaisDispensados: ["extratos", "historico"], roteiroDispensado: true, boasVindasVista: false });
  });
});

describe("boasVindasVista", () => {
  beforeEach(() => window.localStorage.clear());

  it("começa falsa, é lida e gravada no navegador", () => {
    expect(PREFERENCIAS_VAZIAS.boasVindasVista).toBe(false);
    guardarLocal(EMAIL, { ...PREFERENCIAS_VAZIAS, boasVindasVista: true });
    expect(preferenciasLocais(EMAIL).boasVindasVista).toBe(true);
    window.localStorage.setItem(CHAVE_DA_ANA, '{"boasVindasVista":"sim"}');
    expect(preferenciasLocais(EMAIL).boasVindasVista).toBe(false);
  });

  it("juntar usa ou", () => {
    const vista = { ...PREFERENCIAS_VAZIAS, boasVindasVista: true };
    expect(juntar(vista, PREFERENCIAS_VAZIAS).boasVindasVista).toBe(true);
    expect(juntar(PREFERENCIAS_VAZIAS, vista).boasVindasVista).toBe(true);
    expect(juntar(PREFERENCIAS_VAZIAS, PREFERENCIAS_VAZIAS).boasVindasVista).toBe(false);
  });
});

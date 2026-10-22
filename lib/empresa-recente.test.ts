import { afterEach, describe, expect, it } from "vitest";
import { gravarEmpresaRecente } from "./empresa-recente";

const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";

afterEach(() => {
  document.cookie = "ledgr-empresa-recente=; Path=/; Max-Age=0";
});

describe("gravarEmpresaRecente", () => {
  it("grava o cookie com o id da empresa", () => {
    gravarEmpresaRecente(A);
    expect(document.cookie).toContain(`ledgr-empresa-recente=${A}`);
  });

  it("não grava um id que não é UUID", () => {
    gravarEmpresaRecente("lixo; Path=/x");
    expect(document.cookie).not.toContain("ledgr-empresa-recente");
  });
});

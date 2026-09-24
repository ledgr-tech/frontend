import { describe, expect, it } from "vitest";
import { caminhoDaConciliacao } from "./caminhos";

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

describe("caminhoDaConciliacao", () => {
  it("leva o extrato do sistema na URL, que é o que separa um par do outro", () => {
    expect(caminhoDaConciliacao(BANCO, SISTEMA)).toBe(`/conciliacoes/${BANCO}?sistema=${SISTEMA}`);
  });

  it("abre uma linha do mesmo par", () => {
    expect(caminhoDaConciliacao(BANCO, SISTEMA, "c-1")).toBe(
      `/conciliacoes/${BANCO}/c-1?sistema=${SISTEMA}`,
    );
  });

  it("sem o extrato do sistema (a conciliação do mock), fica só o id", () => {
    expect(caminhoDaConciliacao("conc-1")).toBe("/conciliacoes/conc-1");
    expect(caminhoDaConciliacao("conc-1", undefined, "lc-2")).toBe("/conciliacoes/conc-1/lc-2");
  });
});

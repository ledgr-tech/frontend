import { describe, it, expect } from "vitest";
import { DEPOIMENTOS_DE_EXEMPLO, depoimentosDaLanding, type Depoimento } from "./depoimentos";

const REAL: Depoimento = {
  citacao: "Fechamos o mês em uma tarde.",
  nome: "Pessoa Real",
  cargo: "Financeiro",
};

describe("depoimentosDaLanding", () => {
  it("shows nothing when there are no real testimonials and no flag", () => {
    expect(depoimentosDaLanding([], {})).toEqual([]);
  });

  it("shows the examples on a Vercel preview, without the flag", () => {
    expect(depoimentosDaLanding([], { VERCEL_ENV: "preview" })).toBe(DEPOIMENTOS_DE_EXEMPLO);
  });

  it("shows the examples locally only with LEDGR_DEPOIMENTOS_EXEMPLO=1", () => {
    expect(depoimentosDaLanding([], { LEDGR_DEPOIMENTOS_EXEMPLO: "1" })).toBe(DEPOIMENTOS_DE_EXEMPLO);
    expect(depoimentosDaLanding([], { LEDGR_DEPOIMENTOS_EXEMPLO: "true" })).toEqual([]);
  });

  it("never shows the examples on the production deploy, even with the flag on", () => {
    expect(depoimentosDaLanding([], { VERCEL_ENV: "production", LEDGR_DEPOIMENTOS_EXEMPLO: "1" })).toEqual([]);
  });

  it("shows only the real testimonials once there are any, never mixed with the examples", () => {
    expect(depoimentosDaLanding([REAL], { VERCEL_ENV: "preview", LEDGR_DEPOIMENTOS_EXEMPLO: "1" })).toEqual([REAL]);
    expect(depoimentosDaLanding([REAL], { VERCEL_ENV: "production" })).toEqual([REAL]);
  });
});

describe("DEPOIMENTOS_DE_EXEMPLO", () => {
  it("has an odd count, so the last card sits in the middle as in the design", () => {
    expect(DEPOIMENTOS_DE_EXEMPLO.length % 2).toBe(1);
  });

  it("uses unique names (the list key) and ratings between 1 and 5", () => {
    const nomes = DEPOIMENTOS_DE_EXEMPLO.map((depoimento) => depoimento.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    for (const { nota } of DEPOIMENTOS_DE_EXEMPLO) {
      if (nota !== undefined) expect(nota >= 1 && nota <= 5).toBe(true);
    }
  });

  it("keeps the landing copy free of em dashes between clauses", () => {
    for (const { citacao } of DEPOIMENTOS_DE_EXEMPLO) expect(citacao).not.toContain("—");
  });
});

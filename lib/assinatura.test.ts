import { describe, it, expect } from "vitest";
import { adaptarAssinatura, diasRestantes, fraseCurtaDoTeste, fraseDoTeste, planosDoTeste } from "./assinatura";

describe("assinatura", () => {
  it("lê o que o /me manda", () => {
    expect(adaptarAssinatura({ situacao: "teste", plano: "padrao", teste_termina_em: "2026-10-29" })).toEqual({
      situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29",
    });
  });

  it("sem situação, ou com uma desconhecida, é ausente: ninguém é bloqueado", () => {
    expect(adaptarAssinatura({})).toBeNull();
    expect(adaptarAssinatura({ situacao: "trial" })).toBeNull();
  });

  it("plano e data inválidos viram null", () => {
    expect(adaptarAssinatura({ situacao: "teste", plano: "ouro", teste_termina_em: "29/10/2026" })).toEqual({
      situacao: "teste", plano: null, testeTerminaEm: null,
    });
  });

  it("conta os dias pelo calendário de São Paulo", () => {
    expect(diasRestantes("2026-10-29", new Date("2026-10-15T12:00:00-03:00"))).toBe(14);
    expect(diasRestantes("2026-10-29", new Date("2026-10-29T23:30:00-03:00"))).toBe(0);
    // 01:00 UTC do dia 16 ainda é dia 15 em São Paulo
    expect(diasRestantes("2026-10-29", new Date("2026-10-16T01:00:00Z"))).toBe(14);
    expect(diasRestantes("2026-10-10", new Date("2026-10-15T12:00:00-03:00"))).toBe(0);
  });

  it("escreve o que falta", () => {
    expect(fraseDoTeste(9)).toBe("Teste grátis · faltam 9 dias");
    expect(fraseDoTeste(1)).toBe("Teste grátis · falta 1 dia");
    expect(fraseDoTeste(0)).toBe("Teste grátis · último dia");
    expect(fraseCurtaDoTeste(9)).toBe("Teste · 9 dias");
    expect(fraseCurtaDoTeste(1)).toBe("Teste · 1 dia");
    expect(fraseCurtaDoTeste(0)).toBe("Teste · último dia");
  });

  it("os planos do teste vêm de lib/planos", () => {
    expect(planosDoTeste().map((p) => [p.id, p.nome])).toEqual([
      ["essencial", "Essencial"], ["padrao", "Padrão"], ["avancado", "Avançado"],
    ]);
  });
});

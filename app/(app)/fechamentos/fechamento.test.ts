import { describe, it, expect } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import { competencia, primeiraConciliacao } from "./fechamento";

function execucao(id: string, executadaEm: string, lancamentos = 100): Execucao {
  return {
    id,
    extratoBancoId: `banco-${id}`,
    extratoSistemaId: `sistema-${id}`,
    arquivoBanco: `sicredi-${id}.ofx`,
    arquivoSistema: `erp-${id}.csv`,
    executadaEm,
    lancamentos,
    acerto: 90,
    atual: true,
  };
}

describe("competencia", () => {
  it("reads the month of the conciliação and the one after it", () => {
    expect(competencia("Setembro/2026")).toEqual({ mes: "setembro", proximo: "outubro" });
  });

  it("turns the year after december", () => {
    expect(competencia("Dezembro/2026")).toEqual({ mes: "dezembro", proximo: "janeiro" });
  });

  it("has no competência when the lines carried no date", () => {
    // o que `adaptarConciliacao` põe no lugar do mês quando nenhuma linha tem data
    expect(competencia("Conciliação")).toBeNull();
  });
});

describe("primeiraConciliacao", () => {
  // da mais recente para a mais antiga, como o backend devolve
  const EXECUCOES = [
    execucao("e3", "2026-09-24T17:02:11Z"),
    execucao("e2", "2026-06-10T12:00:00Z"),
    execucao("e1", "2026-03-10T13:00:00Z", 1219),
  ];

  it("is the oldest execution, with its month and lançamentos", () => {
    expect(primeiraConciliacao(EXECUCOES, 3)).toEqual({ quando: "Março de 2026", lancamentos: 1219 });
  });

  it("reads the month in Brasília, not in UTC", () => {
    // 01/04 às 02:30 em UTC ainda é 31/03 à noite em Brasília
    const primeira = execucao("e1", "2026-04-01T02:30:00Z");
    expect(primeiraConciliacao([primeira], 1)?.quando).toBe("Março de 2026");
  });

  it("does not guess when the page stops before the first execution", () => {
    expect(primeiraConciliacao(EXECUCOES, 120)).toBeNull();
  });

  it("has nothing without executions", () => {
    expect(primeiraConciliacao([], 0)).toBeNull();
  });
});

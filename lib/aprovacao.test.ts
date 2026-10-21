import { describe, expect, it } from "vitest";
import { aguardaAprovacao, estaJustificada } from "./aprovacao";
import type { Decisao } from "./mock-data";

const JUSTIFICADA: Decisao = { tipo: "justificada", texto: "Juros.", autor: "Bia", em: "2026-10-20T10:00:00Z", rodada: 1 };

describe("aguardaAprovacao e estaJustificada", () => {
  it("a justificada pendente espera aprovação e ainda não vale", () => {
    const pendente = { ...JUSTIFICADA, situacao: "pendente" as const };
    expect(aguardaAprovacao(pendente)).toBe(true);
    expect(estaJustificada(pendente)).toBe(false);
  });

  it("a aprovada vale", () => {
    const aprovada = { ...JUSTIFICADA, situacao: "aprovada" as const, aprovadaPor: "Gil" };
    expect(aguardaAprovacao(aprovada)).toBe(false);
    expect(estaJustificada(aprovada)).toBe(true);
  });

  it("sem situacao (backend anterior à aprovação, ou com ela desligada) vale como aprovada", () => {
    expect(aguardaAprovacao(JUSTIFICADA)).toBe(false);
    expect(estaJustificada(JUSTIFICADA)).toBe(true);
  });

  it("conferida e sem decisão não são justificadas", () => {
    const conferida: Decisao = { ...JUSTIFICADA, tipo: "conferida", texto: null };
    expect(estaJustificada(conferida)).toBe(false);
    expect(aguardaAprovacao(conferida)).toBe(false);
    expect(estaJustificada(null)).toBe(false);
    expect(aguardaAprovacao(undefined)).toBe(false);
  });
});

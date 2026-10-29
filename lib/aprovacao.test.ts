import { describe, expect, it } from "vitest";
import { aguardaAprovacao, aprovadaDepois, estaJustificada, podeDesfazerAprovacao } from "./aprovacao";
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

describe("aprovadaDepois e podeDesfazerAprovacao (backend #164)", () => {
  const aprovadaPorGil: Decisao = {
    ...JUSTIFICADA,
    situacao: "aprovada",
    aprovadaPor: "Gil Gestor",
    aprovadaEm: "2026-10-21T09:00:00Z",
  };

  it("só quem aprovou desfaz, pelo nome de quem está logado", () => {
    expect(aprovadaDepois(aprovadaPorGil)).toBe(true);
    expect(podeDesfazerAprovacao(aprovadaPorGil, "Gil Gestor")).toBe(true);
    expect(podeDesfazerAprovacao(aprovadaPorGil, " Gil Gestor ")).toBe(true);
    expect(podeDesfazerAprovacao(aprovadaPorGil, "Bia")).toBe(false);
    // sem o nome (o GET /me falhou), ninguém vê o botão
    expect(podeDesfazerAprovacao(aprovadaPorGil, "")).toBe(false);
  });

  it("a que nasce aprovada com a aprovação desligada não conta: mesmo autor, um microssegundo depois", () => {
    const nascidaAprovada: Decisao = {
      ...JUSTIFICADA,
      situacao: "aprovada",
      aprovadaPor: "Bia",
      aprovadaEm: "2026-10-20T10:00:00.000001Z",
    };
    expect(aprovadaDepois(nascidaAprovada)).toBe(false);
    expect(podeDesfazerAprovacao(nascidaAprovada, "Bia")).toBe(false);
  });

  it("a pendente, a sem quem aprovou e a conferida não têm aprovação a desfazer", () => {
    expect(podeDesfazerAprovacao({ ...aprovadaPorGil, situacao: "pendente" }, "Gil Gestor")).toBe(false);
    expect(aprovadaDepois(JUSTIFICADA)).toBe(false);
    expect(aprovadaDepois({ ...aprovadaPorGil, tipo: "conferida", texto: null })).toBe(false);
    expect(aprovadaDepois(null)).toBe(false);
  });
});

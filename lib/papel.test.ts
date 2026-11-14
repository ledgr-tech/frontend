import { describe, expect, it } from "vitest";
import { PAPEL_INDISPONIVEL, lerPapel, papeisQueConvida, podeConvidar, podeFecharMes, recusaPorPapel } from "./papel";

describe("lerPapel", () => {
  it("usa o papel que o backend manda", () => {
    expect(lerPapel({ papel: "gestor", administrador: false })).toBe("gestor");
    expect(lerPapel({ papel: "analista" })).toBe("analista");
    expect(lerPapel({ papel: "admin", administrador: true })).toBe("admin");
  });

  it("sem papel, cai no administrador do backend anterior ao #133", () => {
    expect(lerPapel({ administrador: true })).toBe("admin");
    expect(lerPapel({ administrador: false })).toBe("analista");
  });

  it("sem nenhum dos dois, é admin, como a conta única antiga", () => {
    expect(lerPapel({})).toBe("admin");
  });

  it("ignora um papel que não conhece e usa a reserva", () => {
    expect(lerPapel({ papel: "dono", administrador: false })).toBe("analista");
    expect(lerPapel({ papel: 3 })).toBe("admin");
    expect(lerPapel({ papel: "toString" })).toBe("admin");
  });
});

describe("o que cada papel pode", () => {
  it("fecha o mês e convida: admin e gestor, não o analista", () => {
    expect(podeFecharMes("admin")).toBe(true);
    expect(podeFecharMes("gestor")).toBe(true);
    expect(podeFecharMes("analista")).toBe(false);
    expect(podeConvidar("admin")).toBe(true);
    expect(podeConvidar("gestor")).toBe(true);
    expect(podeConvidar("analista")).toBe(false);
  });

  it("o admin convida gestor ou analista; o gestor, só analista; o analista, ninguém", () => {
    expect(papeisQueConvida("admin")).toEqual(["gestor", "analista"]);
    expect(papeisQueConvida("gestor")).toEqual(["analista"]);
    expect(papeisQueConvida("analista")).toEqual([]);
  });
});

describe("recusaPorPapel (D2)", () => {
  it("deixa passar quem pode, recusa com 403 quem não pode e com 503 quando o /me não respondeu", () => {
    expect(recusaPorPapel({ papel: "gestor" }, podeFecharMes, "Só o gestor.")).toBeNull();
    expect(recusaPorPapel({ papel: "analista" }, podeFecharMes, "Só o gestor.")).toEqual({ ok: false, status: 403, erro: "Só o gestor." });
    // sem o /me o papel é o menor, mas o texto de papel seria mentira para um admin de verdade
    expect(recusaPorPapel({ papel: "analista", indisponivel: true }, podeFecharMes, "Só o gestor.")).toEqual({
      ok: false,
      status: 503,
      erro: PAPEL_INDISPONIVEL,
    });
  });
});

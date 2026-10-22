import { describe, expect, it } from "vitest";
import { lerPapel, papeisQueConvida, podeConvidar, podeFecharMes } from "./papel";

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

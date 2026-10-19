import { describe, it, expect } from "vitest";
import { passosDoRoteiro, roteiroVisivel, type DadosDoRoteiro } from "./roteiro";

const NADA: DadosDoRoteiro = {
  toleranciaRevisada: false,
  temExtratoDoBanco: false,
  conciliou: false,
  resolveuAlguma: false,
  fechouAlgum: false,
  conciliacaoComPendencia: null,
};

describe("roteiro", () => {
  it("conta nova: só o plano feito", () => {
    const passos = passosDoRoteiro(NADA);
    expect(passos.map((p) => p.id)).toEqual(["plano", "tolerancia", "banco", "conciliar", "divergencias", "fechar"]);
    expect(passos.filter((p) => p.feito).map((p) => p.id)).toEqual(["plano"]);
    expect(passos[1].destino).toEqual({ tipo: "configuracoes" });
  });

  it("cada passo marca pelo dado certo", () => {
    const passos = passosDoRoteiro({
      ...NADA,
      toleranciaRevisada: true,
      temExtratoDoBanco: true,
      conciliou: true,
      conciliacaoComPendencia: "/conciliacoes/b1",
    });
    expect(passos.filter((p) => p.feito).map((p) => p.id)).toEqual(["plano", "tolerancia", "banco", "conciliar"]);
    expect(passos.find((p) => p.id === "divergencias")?.destino).toEqual({ tipo: "link", href: "/conciliacoes/b1" });
  });

  it("conciliar sem extrato listado ainda conta o banco como enviado", () => {
    const passos = passosDoRoteiro({ ...NADA, conciliou: true });
    expect(passos.find((p) => p.id === "banco")?.feito).toBe(true);
  });

  it("some depois do primeiro mês fechado", () => {
    expect(roteiroVisivel(NADA)).toBe(true);
    expect(roteiroVisivel({ ...NADA, fechouAlgum: true })).toBe(false);
  });
});

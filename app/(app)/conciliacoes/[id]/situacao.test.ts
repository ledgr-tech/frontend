import { describe, it, expect } from "vitest";
import type { Conciliacao, Decisao, LinhaComparacao } from "@/lib/mock-data";
import { continuaDivergindo, decisoesLigadas, situacaoDaLinha } from "./situacao";

const DIVERGENTE: LinhaComparacao = {
  id: "lc-1",
  descricao: "Boleto Aço Norte Bobinas",
  data: "04/09",
  valorBanco: -12640,
  valorSistema: -12604,
  status: "divergente_valor",
  explicacao: null,
  historico: [],
};

function decisao(tipo: Decisao["tipo"], rodada: number): Decisao {
  return {
    tipo,
    texto: tipo === "justificada" ? "Juros de dois dias de atraso." : null,
    autor: "Eduardo Sichelero",
    em: "2026-09-30T13:12:00Z",
    rodada,
  };
}

describe("situacaoDaLinha", () => {
  it("o que o motor casou bate, com ou sem decisão", () => {
    expect(situacaoDaLinha({ ...DIVERGENTE, status: "match_exato" }, 1)).toBe("bate");
    // a justificada que passou a bater numa rodada nova: bateu
    expect(situacaoDaLinha({ ...DIVERGENTE, status: "match_tolerancia", decisao: decisao("justificada", 1) }, 2)).toBe(
      "bate",
    );
  });

  it("divergente sem decisão está a conferir", () => {
    expect(situacaoDaLinha(DIVERGENTE, 1)).toBe("a_conferir");
    expect(situacaoDaLinha({ ...DIVERGENTE, decisao: null }, 1)).toBe("a_conferir");
  });

  it("conferida nesta rodada fica conferida", () => {
    const linha = { ...DIVERGENTE, decisao: decisao("conferida", 2) };
    expect(situacaoDaLinha(linha, 2)).toBe("conferida");
    expect(continuaDivergindo(linha, 2)).toBe(false);
  });

  it("conferida numa rodada anterior e ainda divergente volta para a conferir", () => {
    const linha = { ...DIVERGENTE, decisao: decisao("conferida", 1) };
    expect(situacaoDaLinha(linha, 2)).toBe("a_conferir");
    expect(continuaDivergindo(linha, 2)).toBe(true);
  });

  it("justificada continua justificada nas rodadas seguintes", () => {
    const linha = { ...DIVERGENTE, decisao: decisao("justificada", 1) };
    expect(situacaoDaLinha(linha, 2)).toBe("justificada");
    expect(continuaDivergindo(linha, 2)).toBe(false);
  });
});

describe("decisoesLigadas", () => {
  const conciliacao = (linhas: LinhaComparacao[]): Conciliacao => ({
    id: "c",
    mes: "Setembro/2026",
    status: "em_andamento",
    linhas,
  });

  it("no mock, as decisões ficam em memória e sempre ligadas", () => {
    expect(decisoesLigadas(conciliacao([DIVERGENTE]), false)).toBe(true);
  });

  it("com dado do backend, só quando os itens trazem o campo decisão", () => {
    expect(decisoesLigadas(conciliacao([{ ...DIVERGENTE, decisao: null }]), true)).toBe(true);
    expect(decisoesLigadas(conciliacao([DIVERGENTE]), true)).toBe(false);
  });
});

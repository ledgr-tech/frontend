import { describe, it, expect } from "vitest";
import type { Conciliacao, Decisao, EventoDecisao, LinhaComparacao, TipoEvento } from "@/lib/mock-data";
import { continuaDivergindo, decisoesLigadas, historicoDaLinha, situacaoDaLinha } from "./situacao";

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

describe("historicoDaLinha", () => {
  function evento(tipo: TipoEvento, rodada: number, em: string, texto: string | null = null): EventoDecisao {
    return { tipo, texto, autor: "Eduardo", em, rodada };
  }

  const DO_EXTRATO = { quando: "04/09/2026", evento: "Boleto liquidado em R$ 12.640,00", origem: "Banco" as const };
  const BASE: LinhaComparacao = { ...DIVERGENTE, historico: [DO_EXTRATO] };

  it("põe as decisões depois do que veio dos extratos, na ordem em que foram feitas", () => {
    const linha: LinhaComparacao = {
      ...BASE,
      decisao: null,
      eventos: [
        evento("conferida", 1, "2026-09-24T18:40:00Z"),
        evento("conferencia_desfeita", 1, "2026-09-24T18:41:00Z"),
        evento("justificada", 1, "2026-09-25T13:00:00Z", "Juros de dois dias de atraso."),
        evento("justificativa_desfeita", 1, "2026-09-25T13:05:00Z"),
      ],
    };

    expect(historicoDaLinha(linha, 1)).toEqual([
      DO_EXTRATO,
      { quando: "24/09/2026 15:40", evento: "Conferida por Eduardo", origem: "Ledgr" },
      { quando: "24/09/2026 15:41", evento: "Conferência desfeita por Eduardo", origem: "Ledgr" },
      { quando: "25/09/2026 10:00", evento: "Justificada por Eduardo: Juros de dois dias de atraso.", origem: "Ledgr" },
      { quando: "25/09/2026 10:05", evento: "Justificativa desfeita por Eduardo", origem: "Ledgr" },
    ]);
  });

  it("marca a rodada a partir da segunda, e a conferência que a versão nova não resolveu", () => {
    const linha: LinhaComparacao = {
      ...BASE,
      decisao: { ...evento("justificada", 2, "2026-09-30T13:12:00Z", "Juros de dois dias de atraso."), tipo: "justificada" },
      eventos: [
        evento("conferida", 1, "2026-09-24T18:40:00Z"),
        evento("justificada", 2, "2026-09-30T13:12:00Z", "Juros de dois dias de atraso."),
      ],
    };

    // a rodada 2 foi conciliada em 29/09, às 14:02: é quando a conferência deixou de valer
    expect(historicoDaLinha(linha, 2, "2026-09-29T17:02:00Z").slice(1).map((item) => [item.quando, item.evento])).toEqual([
      ["24/09/2026 15:40", "Conferida por Eduardo"],
      ["29/09/2026 14:02", "Continua divergindo (rodada 2)"],
      ["30/09/2026 10:12", "Justificada por Eduardo (rodada 2): Juros de dois dias de atraso."],
    ]);
  });

  it("não diz que continua divergindo sem uma conferência de pé, nem na linha que passou a bater", () => {
    const desfeita: LinhaComparacao = {
      ...BASE,
      decisao: null,
      eventos: [evento("conferida", 1, "2026-09-24T18:40:00Z"), evento("conferencia_desfeita", 1, "2026-09-24T18:41:00Z")],
    };
    const bateu: LinhaComparacao = {
      ...BASE,
      status: "match_exato",
      decisao: { ...evento("conferida", 1, "2026-09-24T18:40:00Z"), tipo: "conferida" },
      eventos: [evento("conferida", 1, "2026-09-24T18:40:00Z")],
    };

    expect(historicoDaLinha(desfeita, 2).map((item) => item.evento)).not.toContain("Continua divergindo (rodada 2)");
    expect(historicoDaLinha(bateu, 2).map((item) => item.evento)).not.toContain("Continua divergindo (rodada 2)");
  });

  it("sem os eventos, a decisão em vigor entra sozinha no histórico", () => {
    const linha: LinhaComparacao = { ...BASE, decisao: decisao("justificada", 1) };

    expect(historicoDaLinha(linha, 1).at(-1)).toEqual({
      quando: "30/09/2026 10:12",
      evento: "Justificada por Eduardo Sichelero: Juros de dois dias de atraso.",
      origem: "Ledgr",
    });
  });
});

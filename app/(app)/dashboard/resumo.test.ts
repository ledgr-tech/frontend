import { describe, it, expect } from "vitest";
import type { Conciliacao, LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import { resumir, statusDaLinha, origemDaLinha, formatarPercentual } from "./resumo";

function linha(
  status: StatusLinha,
  valorBanco: number | null,
  valorSistema: number | null,
): LinhaComparacao {
  return {
    id: `l-${status}-${valorBanco}-${valorSistema}`,
    descricao: "Lançamento",
    data: "04/09",
    valorBanco,
    valorSistema,
    status,
    explicacao: null,
    historico: [],
  };
}

function conciliacao(linhas: LinhaComparacao[]): Conciliacao {
  return { id: "conc-1", mes: "Setembro 2026", status: "em_andamento", linhas };
}

describe("resumir", () => {
  it("zera tudo quando não há conciliações", () => {
    expect(resumir([])).toMatchObject({ processados: 0, taxaMatch: 0, valorDivergente: 0 });
  });

  it("conta apenas a diferença quando os dois lados existem", () => {
    const resumo = resumir([conciliacao([linha("divergencia_valor", 12640, 12604)])]);
    expect(resumo.valorDivergente).toBe(36);
    expect(resumo.divergentes).toBe(1);
    expect(resumo.semCorrespondente).toBe(0);
  });

  it("conta o valor inteiro quando a linha existe só num lado", () => {
    const resumo = resumir([
      conciliacao([linha("somente_banco", 4180, null), linha("somente_sistema", null, 2150)]),
    ]);
    expect(resumo.semCorrespondente).toBe(2);
    expect(resumo.valorSemCorrespondente).toBe(6330);
    expect(resumo.valorDivergente).toBe(6330);
  });

  it("calcula a taxa de match sobre todas as conciliações", () => {
    const resumo = resumir([
      conciliacao([linha("batido", 100, 100), linha("batido", 200, 200)]),
      conciliacao([linha("divergencia_valor", 300, 280), linha("somente_banco", 50, null)]),
    ]);
    expect(resumo.processados).toBe(4);
    expect(resumo.batidos).toBe(2);
    expect(resumo.taxaMatch).toBe(50);
    expect(formatarPercentual(resumo.taxaMatch)).toBe("50,0%");
  });

  it("linha batida não entra no valor em divergência", () => {
    expect(resumir([conciliacao([linha("batido", 7300, 7300)])]).valorDivergente).toBe(0);
  });
});

describe("statusDaLinha", () => {
  it("traz o rótulo do design e o tom semântico", () => {
    expect(statusDaLinha("divergencia_valor")).toEqual({
      rotulo: "Divergência de valor",
      tom: "risco",
    });
    // uma linha batida e caso resolvido, nao ausencia de status
    expect(statusDaLinha("batido").tom).toBe("ok");
    // falta um dos lados: pendente, nao errado
    expect(statusDaLinha("somente_banco").tom).toBe("atencao");
  });
});

describe("origemDaLinha", () => {
  it("é Sistema quando o banco não tem a linha", () => {
    expect(origemDaLinha(linha("somente_sistema", null, 2150))).toBe("Sistema");
    expect(origemDaLinha(linha("batido", 100, 100))).toBe("Banco");
  });
});

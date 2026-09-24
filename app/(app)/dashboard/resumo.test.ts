import { describe, it, expect } from "vitest";
import type { Conciliacao, LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import {
  resumir,
  statusDaLinha,
  origemDaLinha,
  formatarPercentual,
  formatarDataHora,
  formatarDiaMes,
  periodoDasLinhas,
} from "./resumo";

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
    const resumo = resumir([conciliacao([linha("divergente_valor", 12640, 12604)])]);
    expect(resumo.valorDivergente).toBe(36);
    expect(resumo.divergentes).toBe(1);
    expect(resumo.semCorrespondente).toBe(0);
  });

  it("conta o valor inteiro quando a linha existe só num lado", () => {
    const resumo = resumir([
      conciliacao([linha("sem_correspondencia", 4180, null), linha("sem_correspondencia", null, 2150)]),
    ]);
    expect(resumo.semCorrespondente).toBe(2);
    expect(resumo.valorSemCorrespondente).toBe(6330);
    expect(resumo.valorDivergente).toBe(6330);
  });

  it("calcula a taxa de match sobre todas as conciliações", () => {
    const resumo = resumir([
      conciliacao([linha("match_exato", 100, 100), linha("match_exato", 200, 200)]),
      conciliacao([linha("divergente_valor", 300, 280), linha("sem_correspondencia", 50, null)]),
    ]);
    expect(resumo.processados).toBe(4);
    expect(resumo.batidos).toBe(2);
    expect(resumo.taxaMatch).toBe(50);
    expect(formatarPercentual(resumo.taxaMatch)).toBe("50,0%");
  });

  it("linha batida não entra no valor em divergência", () => {
    expect(resumir([conciliacao([linha("match_exato", 7300, 7300)])]).valorDivergente).toBe(0);
  });
});

describe("statusDaLinha", () => {
  it("traz o rótulo e o tom semântico de cada categoria do backend", () => {
    expect(statusDaLinha(linha("divergente_valor", 12640, null))).toEqual({
      rotulo: "Valor diverge na mesma data",
      tom: "risco",
    });
    // uma linha batida e caso resolvido, nao ausencia de status
    expect(statusDaLinha(linha("match_exato", 100, 100)).tom).toBe("ok");
    // casou dentro da tolerância: continua resolvido
    expect(statusDaLinha(linha("match_tolerancia", 100, 100)).tom).toBe("ok");
    // pagamento repetido custa dinheiro
    expect(statusDaLinha(linha("duplicado", 100, null)).tom).toBe("risco");
    // sobra que o sistema já sabe explicar: fica sem cor
    expect(statusDaLinha(linha("tarifa_bancaria", 42, null)).tom).toBe("neutro");
  });

  it("diz qual lado falta, porque o backend tem um status só para os dois casos", () => {
    expect(statusDaLinha(linha("sem_correspondencia", 4180, null)).rotulo).toBe(
      "Sem correspondência no sistema",
    );
    expect(statusDaLinha(linha("sem_correspondencia", null, 2150)).rotulo).toBe(
      "Sem correspondência no banco",
    );
    expect(statusDaLinha(linha("sem_correspondencia", 4180, null)).tom).toBe("atencao");
  });
});

describe("resumir", () => {
  it("conta match por tolerância como resolvido", () => {
    const resumo = resumir([
      conciliacao([linha("match_exato", 100, 100), linha("match_tolerancia", 200, 200)]),
    ]);
    expect(resumo.batidos).toBe(2);
    expect(resumo.taxaMatch).toBe(100);
    expect(resumo.divergentes).toBe(0);
  });

  it("soma débito e crédito pelo tamanho, não pelo sinal", () => {
    // o backend guarda débito negativo (TRNAMT do OFX); somado com sinal, um
    // débito órfão de 980 descontava da divergência em vez de somar
    const resumo = resumir([
      conciliacao([linha("sem_correspondencia", 4180, null), linha("sem_correspondencia", null, -980)]),
    ]);
    expect(resumo.valorSemCorrespondente).toBe(5160);
    expect(resumo.valorDivergente).toBe(5160);
  });

  it("mede a diferença entre dois débitos pelo tamanho", () => {
    expect(resumir([conciliacao([linha("divergente_valor", -12640, -12604)])]).valorDivergente).toBe(36);
  });

  it("soma em centavos, sem resíduo de float", () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004; em centavos, dá 0.3
    const resumo = resumir([
      conciliacao([linha("duplicado", 0.1, null), linha("duplicado", 0.2, null)]),
    ]);
    expect(resumo.valorDivergente).toBe(0.3);
  });
});

describe("origemDaLinha", () => {
  it("é Sistema quando o banco não tem a linha", () => {
    expect(origemDaLinha(linha("sem_correspondencia", null, 2150))).toBe("Sistema");
    expect(origemDaLinha(linha("match_exato", 100, 100))).toBe("Banco");
  });
});

describe("formatarDataHora", () => {
  it("mostra a hora de Brasília, não a do servidor", () => {
    // o histórico renderiza no servidor, que na Vercel roda em UTC
    expect(formatarDataHora("2026-09-24T17:02:11Z")).toBe("24/09/2026 14:02");
  });

  it("vira o dia junto com o fuso", () => {
    expect(formatarDataHora("2026-10-01T02:30:00Z")).toBe("30/09/2026 23:30");
  });
});

describe("formatarDiaMes", () => {
  it("usa o dia de Brasília", () => {
    expect(formatarDiaMes("2026-10-01T02:30:00Z")).toBe("30/09");
  });
});

describe("periodoDasLinhas", () => {
  function comData(dataISO: string | undefined): LinhaComparacao {
    return { ...linha("match_exato", 100, 100), dataISO };
  }

  it("escreve como o design quando tudo cai no mesmo mês", () => {
    const linhas = [comData("2026-09-30"), comData("2026-09-01"), comData("2026-09-14")];
    expect(periodoDasLinhas(linhas)).toBe("01–30 de setembro");
  });

  it("mostra as duas pontas quando o extrato atravessa o mês", () => {
    expect(periodoDasLinhas([comData("2026-08-28"), comData("2026-09-03")])).toBe("28/08 a 03/09");
  });

  it("não inventa período sem data", () => {
    expect(periodoDasLinhas([comData(undefined)])).toBeNull();
    expect(periodoDasLinhas([])).toBeNull();
  });
});

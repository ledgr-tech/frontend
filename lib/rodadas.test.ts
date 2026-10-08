import { describe, it, expect } from "vitest";
import type { Execucao } from "./adaptadores";
import type { LinhaComparacao, StatusLinha } from "./mock-data";
import { chaveDaLinha, compararRodadas, execucoesVigentes, rodadasDoBanco } from "./rodadas";

function linha(parcial: Partial<LinhaComparacao> = {}): LinhaComparacao {
  return {
    id: "lc-1",
    descricao: "Boleto Aço Norte",
    data: "04/09",
    valorBanco: -12640,
    valorSistema: -12604,
    status: "divergente_valor",
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

describe("chaveDaLinha", () => {
  it("usa a chave da linha, e o id quando ela não tem (o mock)", () => {
    expect(chaveDaLinha(linha({ chave: "b:lb-1" }))).toBe("b:lb-1");
    expect(chaveDaLinha(linha())).toBe("lc-1");
  });
});

function execucao(id: string, banco: string, sistema: string, executadaEm: string, atual = true): Execucao {
  return {
    id,
    extratoBancoId: banco,
    extratoSistemaId: sistema,
    arquivoBanco: `${banco}.ofx`,
    arquivoSistema: `${sistema}.csv`,
    executadaEm,
    lancamentos: 12,
    acerto: 50,
    divergencias: {},
    toleranciaDias: 2,
    atual,
    justificadas: 0,
    periodoInicio: null,
  };
}

describe("rodadasDoBanco", () => {
  // a lista de /execucoes vem da mais recente para a mais antiga
  const execucoes = [
    execucao("e4", "B", "S2", "2026-09-24T17:00:00Z"),
    execucao("e3", "B2", "S3", "2026-09-24T10:00:00Z"),
    execucao("e2", "B", "S2", "2026-09-24T09:00:00Z", false),
    execucao("e1", "B", "S1", "2026-09-23T12:00:00Z"),
  ];

  it("numera as rodadas pela primeira execução de cada extrato do sistema", () => {
    expect(rodadasDoBanco(execucoes, "B").map((r) => [r.numero, r.extratoSistemaId, r.arquivoSistema])).toEqual([
      [1, "S1", "S1.csv"],
      [2, "S2", "S2.csv"],
    ]);
  });

  it("conciliar o mesmo par de novo não cria rodada", () => {
    const rodadas = rodadasDoBanco(execucoes, "B");
    expect(rodadas).toHaveLength(2);
    // a rodada 2 aponta a execução que vale, a mais recente do par
    expect(rodadas[1].execucao.id).toBe("e4");
  });

  it("a execução que vale é a que o backend marca como atual, mesmo no empate de horário", () => {
    const empate = [
      execucao("e-substituida", "B", "S1", "2026-09-24T17:00:00Z", false),
      execucao("e-atual", "B", "S1", "2026-09-24T17:00:00Z"),
    ];
    expect(rodadasDoBanco(empate, "B")[0].execucao.id).toBe("e-atual");
  });

  it("ignora as execuções de outro extrato do banco", () => {
    expect(rodadasDoBanco(execucoes, "B2").map((r) => r.extratoSistemaId)).toEqual(["S3"]);
    expect(rodadasDoBanco(execucoes, "nenhum")).toEqual([]);
  });
});

describe("execucoesVigentes", () => {
  it("vigentes: só a última rodada de cada banco, na ordem recebida", () => {
    const execucoes = [
      execucao("e4", "B", "S2", "2026-09-24T17:00:00Z"),
      execucao("e3", "B2", "S3", "2026-09-24T10:00:00Z"),
      execucao("e2", "B", "S2", "2026-09-24T09:00:00Z", false),
      // a primeira versão do sistema continua "atual" do par dela
      execucao("e1", "B", "S1", "2026-09-23T12:00:00Z"),
    ];
    expect(execucoesVigentes(execucoes).map((e) => e.id)).toEqual(["e4", "e3"]);
  });

  it("uma rodada sem a execução atual na lista (a página cortou) não vale", () => {
    expect(execucoesVigentes([execucao("e2", "B", "S1", "2026-09-24T09:00:00Z", false)])).toEqual([]);
  });
});

describe("compararRodadas", () => {
  const com = (chave: string, status: StatusLinha) => linha({ id: `id-${chave}-${status}`, chave, status });

  it("compara as rodadas pela chave", () => {
    const anterior = [
      com("k1", "divergente_valor"),
      com("k2", "divergente_data"),
      com("k3", "sem_correspondencia"),
      com("k4", "match_exato"),
    ];
    const atual = [
      com("k1", "match_exato"),
      com("k2", "divergente_data"),
      com("k5", "duplicado"),
      com("k4", "divergente_valor"),
    ];
    // k1 bateu e k3 saiu do extrato do sistema; k2 continua; k4 e k5 são novas
    expect(compararRodadas(anterior, atual)).toEqual({ passaramABater: 2, continuamDivergindo: 1, novas: 2 });
  });
});

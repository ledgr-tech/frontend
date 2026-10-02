import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import {
  alturasDasBarras,
  paraGrafico,
  paraRevisar,
  porAno,
  porConciliacao,
  porMes,
  segmentos,
  variacaoEmPontos,
} from "./execucoes";

function execucao(id: string, acerto: number | null, atual = true): Execucao {
  return {
    id,
    extratoBancoId: `banco-${id}`,
    extratoSistemaId: `sistema-${id}`,
    arquivoBanco: `${id}.ofx`,
    arquivoSistema: `${id}.csv`,
    executadaEm: "2026-09-24T17:02:11Z",
    lancamentos: 100,
    acerto,
    divergencias: {},
    toleranciaDias: 1,
    atual,
    justificadas: 0,
  };
}

describe("paraGrafico", () => {
  it("pega as seis mais recentes e põe a mais antiga primeiro", () => {
    // a lista chega da mais recente para a mais antiga, como a tabela
    const lista = ["e8", "e7", "e6", "e5", "e4", "e3", "e2", "e1"].map((id) => execucao(id, 90));
    expect(paraGrafico(lista).map((item) => item.id)).toEqual(["e3", "e4", "e5", "e6", "e7", "e8"]);
  });

  it("deixa de fora execução sem percentual, que não tem barra pra desenhar", () => {
    const lista = [execucao("e3", 95), execucao("e2", null), execucao("e1", 80)];
    expect(paraGrafico(lista).map((item) => item.id)).toEqual(["e1", "e3"]);
  });
});

describe("alturasDasBarras", () => {
  it("dá barra mais alta a acerto maior", () => {
    const [menor, maior] = alturasDasBarras([91.8, 97.3]);
    expect(maior).toBeGreaterThan(menor);
  });

  it("mantém as barras dentro do gráfico mesmo com acerto baixo", () => {
    // a escala antiga (28 + (taxa - 90) * 11) dava altura negativa abaixo de 87,5%
    for (const altura of alturasDasBarras([0, 12.5, 40, 100])) {
      expect(altura).toBeGreaterThanOrEqual(12);
      expect(altura).toBeLessThanOrEqual(116);
    }
  });

  it("amplia a diferença quando tudo está acima de 90%, como no design", () => {
    const [noventaEUm, noventaENove] = alturasDasBarras([91, 99]);
    // de 0 a 100 a diferença seria de ~8px; com a base em 90 fica visível
    expect(noventaENove - noventaEUm).toBeGreaterThan(60);
  });
});

describe("variacaoEmPontos", () => {
  it("compara a mais recente com a mais antiga do gráfico", () => {
    const grafico = paraGrafico([execucao("e3", 96.3), execucao("e2", 70), execucao("e1", 91.8)]);
    expect(variacaoEmPontos(grafico)).toBeCloseTo(4.5);
  });

  it("não tem variação com uma barra só", () => {
    expect(variacaoEmPontos(paraGrafico([execucao("e1", 96.3)]))).toBeNull();
  });
});

/** Uma execução do extrato do banco `banco` com o extrato do sistema `sistema`. */
function doPar(id: string, banco: string, sistema: string, executadaEm: string, atual = true): Execucao {
  return {
    ...execucao(id, 90, atual),
    extratoBancoId: banco,
    extratoSistemaId: sistema,
    arquivoBanco: `${banco}.ofx`,
    arquivoSistema: `${sistema}.csv`,
    executadaEm,
  };
}

describe("porConciliacao", () => {
  // da mais recente para a mais antiga: o banco B na rodada 2 (S2), refeita uma vez, depois da
  // rodada 1 (S1); o banco A com uma rodada só
  const lista = [
    doPar("e4", "B", "S2", "2026-09-24T17:02:00Z"),
    doPar("e3", "B", "S2", "2026-09-24T09:10:00Z", false),
    doPar("e2", "B", "S1", "2026-09-23T12:41:00Z"),
    doPar("e1", "A", "SA", "2026-09-02T19:20:00Z"),
  ];

  it("junta as execuções de cada extrato do banco numa conciliação, puxada pela que vale", () => {
    expect(porConciliacao(lista).map((item) => [item.arquivoBanco, item.rodadas, item.principal.execucao.id])).toEqual([
      ["B.ofx", 2, "e4"],
      ["A.ofx", 1, "e1"],
    ]);
  });

  it("diz a rodada e a situação de cada execução, da mais recente para a mais antiga", () => {
    const [setembro] = porConciliacao(lista);
    expect(setembro.execucoes.map((item) => [item.execucao.id, item.rodada, item.situacao])).toEqual([
      ["e4", 2, "vale"],
      ["e3", 2, "substituida"],
      ["e2", 1, "anterior"],
    ]);
  });

  it("sem a que vale na página, a linha fica com a mais recente que sobrou", () => {
    // a página cortou a e4: a rodada 2 só tem a refeita
    const [conciliacao] = porConciliacao([lista[1], lista[2]]);
    expect(conciliacao.principal.execucao.id).toBe("e3");
    expect(conciliacao.principal.situacao).toBe("substituida");
  });

  it("ordena as conciliações pela data da que vale, não pela execução mais recente", () => {
    const conciliacoes = porConciliacao([
      // a rodada 1 de B conciliada de novo depois da rodada 2: B continua na rodada 2, de 24/09
      doPar("b3", "B", "S1", "2026-10-01T12:00:00Z"),
      doPar("a1", "A", "SA", "2026-09-30T12:00:00Z"),
      doPar("b2", "B", "S2", "2026-09-24T12:00:00Z"),
      doPar("b1", "B", "S1", "2026-09-23T12:00:00Z", false),
    ]);
    expect(conciliacoes.map((item) => [item.extratoBancoId, item.principal.execucao.id])).toEqual([
      ["A", "a1"],
      ["B", "b2"],
    ]);
    expect(conciliacoes[1].execucoes.map((item) => [item.execucao.id, item.situacao])).toEqual([
      ["b3", "anterior"],
      ["b2", "vale"],
      ["b1", "substituida"],
    ]);
  });
});

describe("paraRevisar", () => {
  it("é o que diverge e ninguém justificou", () => {
    const vinteEDois = {
      ...execucao("e1", 50),
      lancamentos: 22,
      divergencias: { divergente_valor: 6, sem_correspondencia: 4 },
      justificadas: 2,
    };
    expect(paraRevisar(vinteEDois)).toBe(8);
  });
});

describe("porMes e porAno", () => {
  it("agrupa pelo mês do extrato, como Fechamentos, e ordena os meses por ele", () => {
    const meses = porMes(
      porConciliacao(
        [
          // o extrato de setembro com a rodada nova em outubro fica em setembro
          doPar("e3", "B3", "S3", "2026-10-02T12:00:00Z"),
          doPar("e2", "B2", "S2", "2026-10-01T12:00:00Z"),
          // o de agosto conciliado atrasado, depois de um de setembro
          doPar("e1", "B1", "S1", "2026-09-30T12:00:00Z"),
          doPar("e0", "B0", "S0", "2026-09-29T12:00:00Z"),
        ],
        { B3: "2026-09", B2: "2026-10", B1: "2026-08", B0: "2026-09" },
      ),
    );
    expect(meses.map((mes) => [mes.titulo, mes.conciliacoes.map((item) => item.principal.execucao.id)])).toEqual([
      ["Outubro de 2026", ["e2"]],
      ["Setembro de 2026", ["e3", "e0"]],
      ["Agosto de 2026", ["e1"]],
    ]);
  });

  it("sem o mês do extrato, cai no mês em que a que vale rodou, no fuso de Brasília; e os meses vão por ano", () => {
    const meses = porMes(
      porConciliacao([
        // 01/01 às 02h em UTC ainda é 31/12 em Brasília
        doPar("e4", "B4", "S4", "2026-01-01T02:00:00Z"),
        doPar("e3", "B3", "S3", "2025-12-20T12:00:00Z"),
        doPar("e2", "B2", "S2", "2025-11-30T12:00:00Z"),
        doPar("e1", "B1", "S1", "2024-12-01T12:00:00Z"),
      ]),
    );
    expect(
      porAno(meses).map(({ ano, meses: doAno }) => [
        ano,
        doAno.map((mes) => [mes.titulo, mes.conciliacoes.map((item) => item.principal.execucao.id)]),
      ]),
    ).toEqual([
      ["2025", [["Dezembro de 2025", ["e4", "e3"]], ["Novembro de 2025", ["e2"]]]],
      ["2024", [["Dezembro de 2024", ["e1"]]]],
    ]);
  });
});

describe("segmentos", () => {
  it("parte a execução por tom de status, na ordem da régua, com os nomes da comparação", () => {
    const partes = segmentos({
      ...execucao("e1", 50),
      lancamentos: 20,
      divergencias: { tarifa_bancaria: 2, divergente_data: 3, sem_correspondencia: 1 },
    });
    expect(partes.map((parte) => [parte.rotulo, parte.quantidade])).toEqual([
      ["Bate", 14],
      ["Data diverge, Falta", 4],
      ["Tarifa", 2],
    ]);
  });
});

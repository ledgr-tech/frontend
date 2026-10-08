import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import {
  alturasNoGrafico,
  matchNaTela,
  paraRevisar,
  porAno,
  porConciliacao,
  porMes,
  rotulosDaSerie,
  segmentos,
  serieMensal,
  taxaDeMatch,
} from "./execucoes";
import { formatarPercentual } from "../dashboard/resumo";

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
    periodoInicio: null,
  };
}

/**
 * Uma execução de `lancamentos` linhas, das quais `divergentes` não casaram, com o extrato do banco
 * começando em `periodoInicio`.
 */
function doMes(
  id: string,
  banco: string,
  executadaEm: string,
  lancamentos: number,
  divergentes: number,
  periodoInicio: string | null = null,
): Execucao {
  return {
    ...execucao(id, null),
    extratoBancoId: banco,
    executadaEm,
    periodoInicio,
    lancamentos,
    divergencias: divergentes > 0 ? { divergente_valor: divergentes } : {},
  };
}

describe("serieMensal", () => {
  it("um ponto por mês do extrato, pesado pelos lançamentos, do mais antigo ao mais novo", () => {
    const serie = serieMensal(
      [
        // setembro rodou em outubro, mas o extrato do banco começa em setembro
        doMes("s", "B-set", "2026-10-02T12:00:00Z", 22, 10, "2026-09-01"),
        doMes("a", "B-ago", "2026-09-02T12:00:00Z", 100, 8, "2026-08-01"),
        // dois bancos em junho: 370 de 400, não a média de 100% e 90%
        doMes("j1", "itau-jun", "2026-07-06T12:00:00Z", 100, 0, "2026-06-01"),
        doMes("j2", "sicredi-jun", "2026-07-06T12:00:00Z", 300, 30, "2026-06-02"),
      ],
    );
    expect(serie.map((ponto) => [ponto.chave, ponto.conciliados, ponto.lancamentos, ponto.conciliacoes])).toEqual([
      ["2026-06", 370, 400, 2],
      ["2026-08", 92, 100, 1],
      ["2026-09", 12, 22, 1],
    ]);
    expect(serie.map((ponto) => ponto.taxa)).toEqual([92.5, 92, (12 / 22) * 100]);
  });

  it("sem o período do extrato do banco, usa o mês em que rodou, no fuso de Brasília", () => {
    // 01/10 às 02h em UTC ainda é 30/09 em Brasília
    expect(serieMensal([doMes("e", "B", "2026-10-01T02:00:00Z", 10, 1)]).map((ponto) => ponto.chave)).toEqual([
      "2026-09",
    ]);
  });

  it("fica com os seis meses mais recentes, e deixa de fora o mês sem lançamento", () => {
    const meses = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
    const serie = serieMensal(
      [
        ...meses.map((mes) => doMes(mes, `B${mes}`, `${mes}-20T12:00:00Z`, 10, 0, `${mes}-01`)),
        doMes("vazio", "Bv", "2026-08-20T12:00:00Z", 0, 0, "2026-08-01"),
      ],
    );
    expect(serie.map((ponto) => ponto.chave)).toEqual(meses.slice(1));
  });
});

describe("rotulosDaSerie", () => {
  it("o mês abreviado, com o ano no último ponto de cada ano", () => {
    const chaves = (lista: string[]) => lista.map((chave) => ({ chave }));
    expect(rotulosDaSerie(chaves(["2026-05", "2026-06", "2026-09"]))).toEqual(["mai", "jun", "set/26"]);
    expect(rotulosDaSerie(chaves(["2025-11", "2025-12", "2026-01", "2026-02"]))).toEqual([
      "nov",
      "dez/25",
      "jan",
      "fev/26",
    ]);
  });
});

describe("alturasNoGrafico", () => {
  it("vai de 0 (a base) a 1 (100%), com a base em 90% enquanto tudo estiver acima dela", () => {
    // de 0 a 100, 91% e 99% quase se encostariam; com a base em 90, a diferença aparece
    expect(alturasNoGrafico([91, 99, 100])).toEqual([0.1, 0.9, 1]);
  });

  it("desce a base de 10 em 10 quando uma taxa cai abaixo dela", () => {
    const [queda, cheia] = alturasNoGrafico([54.5, 100]);
    expect(cheia).toBe(1);
    // base em 50
    expect(queda).toBeCloseTo(0.09);
  });
});

/** Uma execução do extrato do banco `banco` com o extrato do sistema `sistema`. */
function doPar(
  id: string,
  banco: string,
  sistema: string,
  executadaEm: string,
  atual = true,
  periodoInicio: string | null = null,
): Execucao {
  return {
    ...execucao(id, 90, atual),
    extratoBancoId: banco,
    extratoSistemaId: sistema,
    arquivoBanco: `${banco}.ofx`,
    arquivoSistema: `${sistema}.csv`,
    executadaEm,
    periodoInicio,
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

describe("taxaDeMatch", () => {
  it("conta as linhas que casaram, não o percentual que o backend já arredondou", () => {
    // 12 de 22 é 54,54%: o backend manda 54.55, que na tela viraria 54,6%
    const vinteEDois = { ...execucao("e1", 54.55), lancamentos: 22, divergencias: { divergente_valor: 10 } };
    expect(formatarPercentual(taxaDeMatch(vinteEDois)!)).toBe("54,5%");
    expect(matchNaTela(vinteEDois)).toBe("54,5%");
  });

  it("não tem taxa sem lançamento", () => {
    expect(taxaDeMatch({ ...execucao("e1", null), lancamentos: 0 })).toBeNull();
    expect(matchNaTela({ ...execucao("e1", null), lancamentos: 0 })).toBe("—");
  });
});

describe("porMes e porAno", () => {
  it("agrupa pelo mês em que o extrato do banco começa, como Fechamentos, e ordena os meses por ele", () => {
    const meses = porMes(
      porConciliacao([
        // o extrato de setembro com a rodada nova em outubro fica em setembro
        doPar("e3", "B3", "S3", "2026-10-02T12:00:00Z", true, "2026-09-01"),
        doPar("e2", "B2", "S2", "2026-10-01T12:00:00Z", true, "2026-10-01"),
        // o de agosto conciliado atrasado, depois de um de setembro; e um que cruza agosto e
        // setembro fica no mês em que começa
        doPar("e1", "B1", "S1", "2026-09-30T12:00:00Z", true, "2026-08-01"),
        doPar("e0", "B0", "S0", "2026-09-29T12:00:00Z", true, "2026-09-15"),
      ]),
    );
    expect(meses.map((mes) => [mes.titulo, mes.conciliacoes.map((item) => item.principal.execucao.id)])).toEqual([
      ["Outubro de 2026", ["e2"]],
      ["Setembro de 2026", ["e3", "e0"]],
      ["Agosto de 2026", ["e1"]],
    ]);
  });

  it("sem o período do extrato do banco, cai no mês em que a que vale rodou, no fuso de Brasília; e os meses vão por ano", () => {
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

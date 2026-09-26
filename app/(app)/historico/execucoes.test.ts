import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import { alturasDasBarras, paraGrafico, porMes, segmentos, variacaoEmPontos } from "./execucoes";

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

describe("porMes", () => {
  it("agrupa pelo mês em que rodou, no fuso de Brasília, mantendo a ordem", () => {
    const meses = porMes([
      { ...execucao("e3", 90), executadaEm: "2026-10-01T02:00:00Z" },
      { ...execucao("e2", 90), executadaEm: "2026-09-20T12:00:00Z" },
      { ...execucao("e1", 90), executadaEm: "2026-08-31T12:00:00Z" },
    ]);
    // 01/10 às 02h em UTC ainda é 30/09 em Brasília
    expect(meses.map((mes) => [mes.titulo, mes.execucoes.map((item) => item.id)])).toEqual([
      ["Setembro de 2026", ["e3", "e2"]],
      ["Agosto de 2026", ["e1"]],
    ]);
  });
});

describe("segmentos", () => {
  it("parte a execução por tom de status, na ordem da régua, só os que têm linha", () => {
    const partes = segmentos({
      ...execucao("e1", 50),
      lancamentos: 20,
      divergencias: { tarifa_bancaria: 2, divergente_data: 3, sem_correspondencia: 1 },
    });
    expect(partes.map((parte) => [parte.rotulo, parte.quantidade])).toEqual([
      ["Conciliados", 14],
      ["Incompletos", 4],
      ["Já explicados", 2],
    ]);
  });
});

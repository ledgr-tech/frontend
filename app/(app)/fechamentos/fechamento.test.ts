import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import type { ParDoFechamento } from "../conciliacoes/acoes";
import { agruparPorMes } from "./fechamento";

function par(
  id: string,
  parcial: Partial<Execucao> = {},
  extra: Partial<Omit<ParDoFechamento, "execucao">> = {},
): ParDoFechamento {
  return {
    execucao: {
      id,
      extratoBancoId: `banco-${id}`,
      extratoSistemaId: `sistema-${id}`,
      arquivoBanco: `sicredi-${id}.ofx`,
      arquivoSistema: `erp-${id}.csv`,
      executadaEm: "2026-10-02T14:00:00Z",
      lancamentos: 100,
      acerto: 100,
      divergencias: {},
      atual: true,
      ...parcial,
    },
    primeiraData: "2026-09-01",
    naoLidas: [],
    ...extra,
  };
}

describe("agruparPorMes", () => {
  it("põe no mesmo mês os pares de extratos daquele mês, somando o que cada um deixou", () => {
    const [setembro] = agruparPorMes([
      par("itau", { lancamentos: 140, divergencias: { divergente_valor: 7, duplicado: 3 } }),
      par("sicredi", { lancamentos: 60, divergencias: { divergente_valor: 2 } }, { primeiraData: "2026-09-03" }),
    ]);

    expect(setembro).toMatchObject({
      chave: "2026-09",
      titulo: "Setembro de 2026",
      proximo: "outubro",
      lancamentos: 200,
      divergentes: 12,
      conciliados: 188,
      pronto: false,
    });
    expect(setembro.pares.map((item) => item.execucao.id)).toEqual(["itau", "sicredi"]);
  });

  it("ordena os meses do mais recente para o mais antigo", () => {
    const meses = agruparPorMes([
      par("ago", {}, { primeiraData: "2026-08-01" }),
      par("set", {}, { primeiraData: "2026-09-01" }),
      par("dez", {}, { primeiraData: "2025-12-01" }),
    ]);
    expect(meses.map((mes) => mes.chave)).toEqual(["2026-09", "2026-08", "2025-12"]);
  });

  it("vira o ano no mês seguinte a dezembro", () => {
    expect(agruparPorMes([par("dez", {}, { primeiraData: "2025-12-01" })])[0].proximo).toBe("janeiro");
  });

  it("usa o mês em que foi conciliado, no fuso de Brasília, quando o extrato não tem data", () => {
    // 01/10 às 02h em UTC ainda é 30/09 em Brasília
    const [mes] = agruparPorMes([par("vazio", { executadaEm: "2026-10-01T02:00:00Z" }, { primeiraData: null })]);
    expect(mes.chave).toBe("2026-09");
  });

  it("lista as pendências da mais grave para a mais leve, e na mesma cor a maior antes", () => {
    const [mes] = agruparPorMes([
      par("a", {
        divergencias: { tarifa_bancaria: 9, sem_correspondencia: 2, divergente_data: 5, divergente_valor: 1, duplicado: 4 },
      }),
    ]);
    expect(mes.pendencias.map((pendencia) => [pendencia.rotulo, pendencia.quantidade])).toEqual([
      ["Possível duplicidade", 4],
      ["Valor diverge na mesma data", 1],
      ["Mesmo valor em outra data", 5],
      ["Sem correspondência", 2],
      ["Tarifa bancária", 9],
    ]);
  });

  it("só está pronto sem divergência e com os arquivos lidos por inteiro", () => {
    expect(agruparPorMes([par("ok")])[0].pronto).toBe(true);
    const comLinhaNaoLida = agruparPorMes([par("x", {}, { naoLidas: [{ nome: "erp-x.csv", linhas: 2 }] })])[0];
    expect(comLinhaNaoLida.pronto).toBe(false);
    expect(comLinhaNaoLida.naoLidas).toEqual([{ nome: "erp-x.csv", linhas: 2 }]);
  });
});

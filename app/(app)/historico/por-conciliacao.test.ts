import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import { csvDoHistorico } from "./por-conciliacao";

function execucao(parcial: Partial<Execucao>): Execucao {
  return {
    id: "e1",
    extratoBancoId: "b",
    extratoSistemaId: "s",
    arquivoBanco: "sicredi.ofx",
    arquivoSistema: "erp.csv",
    executadaEm: "2026-09-24T17:02:11Z",
    lancamentos: 140,
    acerto: 70,
    divergencias: { divergente_valor: 42 },
    toleranciaDias: 1,
    atual: true,
    justificadas: 0,
    periodoInicio: null,
    ...parcial,
  };
}

describe("csvDoHistorico", () => {
  it("sai no padrão do Excel em português: BOM, ponto e vírgula, CRLF e vírgula decimal", () => {
    const csv = csvDoHistorico([
      execucao({ justificadas: 5 }),
      execucao({ id: "e0", lancamentos: 0, acerto: null, divergencias: {}, atual: false }),
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Executada em;Arquivo do banco;Rodada;Arquivo do sistema;Lançamentos;Conciliados;Justificadas;Match;Tolerância (dias);Situação",
      "24/09/2026 14:02;sicredi.ofx;1;erp.csv;140;98;5;70,00;1;Vale",
      "24/09/2026 14:02;sicredi.ofx;1;erp.csv;0;0;0;;1;Substituída",
    ]);
  });

  it("calcula o match pelas contagens, como as telas, sem depender do percentual do backend", () => {
    const [, linha] = csvDoHistorico([execucao({ acerto: null })]).slice(1).split("\r\n");
    expect(linha).toContain(";140;98;0;70,00;");
  });

  it("numera as rodadas de cada extrato do banco e marca a anterior", () => {
    const csv = csvDoHistorico([
      execucao({ id: "e2", extratoSistemaId: "s2", arquivoSistema: "erp-v2.csv", executadaEm: "2026-09-25T12:00:00Z" }),
      execucao({ id: "e1" }),
    ]);
    const [, nova, antiga] = csv.slice(1).split("\r\n");
    expect(nova).toContain(";sicredi.ofx;2;erp-v2.csv;");
    expect(nova.endsWith(";Vale")).toBe(true);
    expect(antiga).toContain(";sicredi.ofx;1;erp.csv;");
    expect(antiga.endsWith(";Anterior")).toBe(true);
  });

  it("não deixa nome de arquivo virar fórmula no Excel, e protege o separador", () => {
    const csv = csvDoHistorico([execucao({ arquivoBanco: "=HYPERLINK(1)", arquivoSistema: 'a;"b".csv' })]);
    expect(csv).toContain(`;'=HYPERLINK(1);1;"a;""b"".csv";`);
  });
});

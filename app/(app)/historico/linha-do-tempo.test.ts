import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import { csvDoHistorico } from "./linha-do-tempo";

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
    ...parcial,
  };
}

describe("csvDoHistorico", () => {
  it("sai no padrão do Excel em português: BOM, ponto e vírgula, CRLF e vírgula decimal", () => {
    const csv = csvDoHistorico([execucao({}), execucao({ id: "e0", acerto: null, atual: false })]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Executada em;Arquivo do banco;Arquivo do sistema;Lançamentos;Conciliados;Match;Tolerância (dias);Situação",
      "24/09/2026 14:02;sicredi.ofx;erp.csv;140;98;70,00;1;Atual",
      "24/09/2026 14:02;sicredi.ofx;erp.csv;140;98;;1;Substituída",
    ]);
  });

  it("não deixa nome de arquivo virar fórmula no Excel, e protege o separador", () => {
    const csv = csvDoHistorico([execucao({ arquivoBanco: "=HYPERLINK(1)", arquivoSistema: 'a;"b".csv' })]);
    expect(csv).toContain(`;'=HYPERLINK(1);"a;""b"".csv";`);
  });
});

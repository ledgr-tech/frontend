import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import type { StatusLinha } from "@/lib/mock-data";
import { ordemDeTrabalho, pedemDecisao, seloDaConciliacao, type ConciliacaoNaLista } from "./lista";

function conciliacao(
  id: string,
  competencia: string,
  executadaEm: string,
  divergencias: Partial<Record<StatusLinha, number>> = {},
  justificadas = 0,
): ConciliacaoNaLista {
  const execucao: Execucao = {
    id,
    extratoBancoId: `banco-${id}`,
    extratoSistemaId: `sistema-${id}`,
    arquivoBanco: `${id}.ofx`,
    arquivoSistema: `${id}.csv`,
    executadaEm,
    lancamentos: 100,
    acerto: 90,
    divergencias,
    toleranciaDias: 1,
    atual: true,
    justificadas,
    periodoInicio: null,
  };
  return {
    extratoBancoId: execucao.extratoBancoId,
    extratoSistemaId: execucao.extratoSistemaId,
    arquivoBanco: execucao.arquivoBanco,
    arquivoSistema: execucao.arquivoSistema,
    competencia,
    rodada: 1,
    rodadas: 1,
    execucao,
  };
}

describe("pedemDecisao", () => {
  it("é o que diverge e ninguém justificou", () => {
    expect(pedemDecisao(conciliacao("a", "2026-09", "2026-09-24T12:00:00Z", { divergente_valor: 6, sem_correspondencia: 4 }, 2))).toBe(8);
  });
});

describe("ordemDeTrabalho", () => {
  it("o que pede decisão primeiro, cada grupo do mês do extrato mais recente para o mais antigo", () => {
    const lista = [
      conciliacao("pronta-set", "2026-09", "2026-09-30T12:00:00Z"),
      conciliacao("aberta-ago", "2026-08", "2026-09-02T12:00:00Z", { duplicado: 1 }),
      conciliacao("aberta-set", "2026-09", "2026-09-24T12:00:00Z", { divergente_data: 2 }),
      conciliacao("pronta-jul", "2026-07", "2026-08-05T12:00:00Z"),
      // mesmo mês: a que rodou por último antes
      conciliacao("aberta-set-2", "2026-09", "2026-09-25T12:00:00Z", { divergente_data: 1 }),
    ];
    expect(ordemDeTrabalho(lista).map((item) => item.execucao.id)).toEqual([
      "aberta-set-2",
      "aberta-set",
      "aberta-ago",
      "pronta-set",
      "pronta-jul",
    ]);
  });

  it("uma divergência justificada não segura a conciliação entre as abertas", () => {
    const justificada = conciliacao("j", "2026-09", "2026-09-24T12:00:00Z", { sem_correspondencia: 1 }, 1);
    const aberta = conciliacao("a", "2026-08", "2026-09-02T12:00:00Z", { sem_correspondencia: 1 });
    expect(ordemDeTrabalho([justificada, aberta]).map((item) => item.execucao.id)).toEqual(["a", "j"]);
  });
});

describe("seloDaConciliacao", () => {
  it("terracota quando o que falta custa dinheiro, dourado quando é só incompleto, verde sem pendência", () => {
    expect(seloDaConciliacao(conciliacao("a", "2026-09", "2026-09-24T12:00:00Z", { divergente_valor: 1, divergente_data: 2 }))).toEqual({
      rotulo: "3 pendências",
      tom: "risco",
    });
    expect(seloDaConciliacao(conciliacao("b", "2026-09", "2026-09-24T12:00:00Z", { divergente_data: 1 }))).toEqual({
      rotulo: "1 pendência",
      tom: "atencao",
    });
    expect(seloDaConciliacao(conciliacao("c", "2026-09", "2026-09-24T12:00:00Z", { tarifa_bancaria: 1 }, 1))).toEqual({
      rotulo: "Sem pendência",
      tom: "ok",
    });
  });
});

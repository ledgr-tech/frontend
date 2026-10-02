import { describe, it, expect, beforeEach } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import type { VisaoGeral } from "./conciliacoes/acoes";
import { avisosDoMes, idsLidos, marcarLidos } from "./avisos";

const EXECUCAO = { id: "e7", executadaEm: "2026-09-26T13:28:00Z" } as Execucao;

function linha(id: string, status: StatusLinha, valorBanco: number | null, valorSistema: number | null): LinhaComparacao {
  return { id, descricao: id, data: "04/09", valorBanco, valorSistema, status, explicacao: null, historico: [] };
}

function visao(linhas: LinhaComparacao[], naoLidas: VisaoGeral["arquivosComLinhasNaoLidas"] = []): VisaoGeral {
  return {
    execucoes: [EXECUCAO],
    total: 1,
    recente: {
      execucao: EXECUCAO,
      conciliacao: { id: "b", extratoSistemaId: "s", mes: "Setembro/2026", status: "em_andamento", linhas },
    },
    arquivosComLinhasNaoLidas: naoLidas,
  };
}

describe("avisosDoMes", () => {
  it("has nothing to say before the first conciliation", () => {
    expect(avisosDoMes({ execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] })).toEqual([]);
  });

  it("has nothing to say when everything matched and every line was read", () => {
    expect(avisosDoMes(visao([linha("ok", "match_exato", 100, 100)]))).toEqual([]);
  });

  it("counts what still needs a decision, from the real lines, and leads to the conciliation", () => {
    const [aviso] = avisosDoMes(
      visao([
        linha("ok", "match_exato", 100, 100),
        linha("t1", "tarifa_bancaria", -12.9, null),
        linha("t2", "tarifa_bancaria", -10, null),
        linha("v", "divergente_valor", 12640, 12604),
      ]),
    );

    expect(aviso).toMatchObject({
      id: "divergencias-e7",
      titulo: "3 divergências aguardando decisão",
      tom: "risco",
      href: "/conciliacoes/b?sistema=s",
      quando: "Conciliação de 26/09/2026 10:28",
    });
    // a categoria com mais linhas, não a mais grave
    expect(aviso.texto.replaceAll(" ", " ")).toBe("R$ 59 em aberto, a maior parte em “Tarifa bancária”.");
  });

  it("leaves the justified lines out of what still needs a decision", () => {
    const justificada = (id: string, status: StatusLinha, banco: number | null, sistema: number | null) => ({
      ...linha(id, status, banco, sistema),
      decisao: { tipo: "justificada" as const, texto: "Adiantamento.", autor: "Eduardo", em: "2026-09-30T13:12:00Z", rodada: 1 },
    });
    const [aviso] = avisosDoMes(
      visao([justificada("j", "sem_correspondencia", 4180, null), linha("v", "divergente_valor", 12640, 12604)]),
    );
    expect(aviso.titulo).toBe("1 divergência aguardando decisão");
    expect(aviso.texto.replace(/\s/g, " ")).toBe("R$ 36 em aberto, a maior parte em “Valor diverge na mesma data”.");
  });

  it("has nothing to say, and does not break, when every divergence was justified", () => {
    const justificada = {
      ...linha("j", "sem_correspondencia", 4180, null),
      decisao: { tipo: "justificada" as const, texto: "Adiantamento.", autor: "Eduardo", em: "2026-09-30T13:12:00Z", rodada: 1 },
    };
    expect(avisosDoMes(visao([linha("ok", "match_exato", 1, 1), justificada]))).toEqual([]);
  });

  it("points each file with unread lines to the extratos screen", () => {
    const avisos = avisosDoMes(visao([linha("ok", "match_exato", 1, 1)], [{ nome: "itau.ofx", linhas: 1 }]));
    expect(avisos).toEqual([
      expect.objectContaining({
        id: "nao-lidas-e7-itau.ofx",
        titulo: "1 linha não lida em itau.ofx",
        tom: "atencao",
        href: "/extratos",
      }),
    ]);
  });
});

describe("avisos lidos", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers only the notices that exist now", () => {
    marcarLidos(["divergencias-e7"]);
    expect(idsLidos()).toEqual(["divergencias-e7"]);
    marcarLidos(["divergencias-e8"]);
    expect(idsLidos()).toEqual(["divergencias-e8"]);
  });

  it("treats the old yes/no flag and broken values as nothing read", () => {
    window.localStorage.setItem("ledgr_avisos_lidos", "1");
    expect(idsLidos()).toEqual([]);
    window.localStorage.setItem("ledgr_avisos_lidos", "{quebrado");
    expect(idsLidos()).toEqual([]);
  });
});

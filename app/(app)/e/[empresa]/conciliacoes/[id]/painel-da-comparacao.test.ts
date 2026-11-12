import { describe, it, expect } from "vitest";
import type { Decisao, LinhaComparacao } from "@/lib/mock-data";
import { acoesDoPainel, ofereceExplicacao } from "./painel-da-comparacao";

const DIVERGENTE: LinhaComparacao = {
  id: "lc-1",
  descricao: "Boleto Aço Norte Bobinas",
  data: "04/09",
  valorBanco: -12640,
  valorSistema: -12604,
  status: "divergente_valor",
  explicacao: null,
  historico: [],
};

function decisao(tipo: Decisao["tipo"], situacao?: "pendente" | "aprovada"): Decisao {
  return { tipo, texto: "Juros.", autor: "Marina", em: "2026-09-30T13:12:00Z", rodada: 1, situacao };
}

const ADMIN = { podeDecidir: true, podeAprovar: true };
const ANALISTA = { podeDecidir: true, podeAprovar: false };
const NADA = { justificar: false, aprovar: false, avisoDeAprovacao: false, desfazer: false, desfazerAprovacao: false, avisoDeQuemAprovou: false };

describe("acoesDoPainel", () => {
  it("a divergência sem decisão pode ser justificada, por qualquer papel", () => {
    for (const papel of [ADMIN, ANALISTA]) {
      expect(acoesDoPainel({ linha: DIVERGENTE, rodada: 1, ...papel })).toEqual({ ...NADA, justificar: true });
    }
  });

  it("a conferida pode ser justificada, e a conferida numa rodada passada também", () => {
    const conferida = { ...DIVERGENTE, decisao: { ...decisao("conferida"), rodada: 1 } };
    expect(acoesDoPainel({ linha: conferida, rodada: 1, ...ADMIN }).justificar).toBe(true);
    expect(acoesDoPainel({ linha: conferida, rodada: 2, ...ADMIN }).justificar).toBe(true);
  });

  it("a que espera aprovação oferece Aprovar e Rejeitar ao admin e ao gestor, e só o aviso ao analista", () => {
    const aguardando = { ...DIVERGENTE, decisao: decisao("justificada", "pendente") };
    // quem pode decidir ainda desfaz a justificativa, nos dois papéis
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...ADMIN })).toEqual({ ...NADA, aprovar: true, desfazer: true });
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...ANALISTA })).toEqual({ ...NADA, avisoDeAprovacao: true, desfazer: true });
  });

  it("a justificada que não foi aprovada por alguém se desfaz; a que bateu não oferece nada", () => {
    const justificada = { ...DIVERGENTE, decisao: decisao("justificada", "aprovada") };
    expect(acoesDoPainel({ linha: justificada, rodada: 1, ...ANALISTA })).toEqual({ ...NADA, desfazer: true });
    const bateu = { ...DIVERGENTE, status: "match_exato" as const };
    expect(acoesDoPainel({ linha: bateu, rodada: 1, ...ADMIN })).toEqual(NADA);
  });

  it("a aprovada por alguém só sai pelo desfazer da aprovação, e só por quem aprovou", () => {
    const aprovada = {
      ...DIVERGENTE,
      decisao: { ...decisao("justificada", "aprovada"), aprovadaPor: "Gabriela", aprovadaEm: "2026-09-30T15:00:00Z" },
    };
    // sem a resposta do backend #174, vale o nome de quem está logado
    expect(acoesDoPainel({ linha: aprovada, rodada: 1, ...ADMIN, nome: "Gabriela" })).toEqual({ ...NADA, desfazerAprovacao: true });
    expect(acoesDoPainel({ linha: aprovada, rodada: 1, ...ADMIN, nome: "Financeiro" })).toEqual({ ...NADA, avisoDeQuemAprovou: true });
    // com ela, o backend decide (o admin quando quem aprovou saiu)
    const liberada = { ...aprovada, decisao: { ...aprovada.decisao, podeDesfazerAprovacao: true } };
    expect(acoesDoPainel({ linha: liberada, rodada: 1, ...ADMIN, nome: "Financeiro" }).desfazerAprovacao).toBe(true);
    // o analista não desfaz aprovação
    expect(acoesDoPainel({ linha: liberada, rodada: 1, ...ANALISTA, nome: "Gabriela" })).toEqual({ ...NADA, avisoDeQuemAprovou: true });
  });

  it("sem onde gravar (mês fechado, rodada passada, mock sem decisão) não há ação de decidir, nem aviso de aprovação mudando", () => {
    const aguardando = { ...DIVERGENTE, decisao: decisao("justificada", "pendente") };
    const travado = { podeDecidir: false, podeAprovar: true };
    expect(acoesDoPainel({ linha: DIVERGENTE, rodada: 1, ...travado }).justificar).toBe(false);
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...travado }).aprovar).toBe(false);
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...travado }).desfazer).toBe(false);
  });
});

describe("ofereceExplicacao", () => {
  it("só oferece com dado do backend, divergência e sem explicação ainda", () => {
    expect(ofereceExplicacao(DIVERGENTE, true)).toBe(true);
    // o mock não tem o que pedir
    expect(ofereceExplicacao(DIVERGENTE, false)).toBe(false);
    expect(ofereceExplicacao({ ...DIVERGENTE, explicacao: "O banco cobrou juros." }, true)).toBe(false);
    expect(ofereceExplicacao({ ...DIVERGENTE, status: "match_exato" }, true)).toBe(false);
  });
});

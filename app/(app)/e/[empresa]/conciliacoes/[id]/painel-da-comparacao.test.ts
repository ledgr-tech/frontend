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

describe("acoesDoPainel", () => {
  it("a divergência sem decisão pode ser justificada, por qualquer papel", () => {
    for (const papel of [ADMIN, ANALISTA]) {
      expect(acoesDoPainel({ linha: DIVERGENTE, rodada: 1, ...papel })).toEqual({
        justificar: true,
        aprovar: false,
        avisoDeAprovacao: false,
      });
    }
  });

  it("a conferida pode ser justificada, e a conferida numa rodada passada também", () => {
    const conferida = { ...DIVERGENTE, decisao: { ...decisao("conferida"), rodada: 1 } };
    expect(acoesDoPainel({ linha: conferida, rodada: 1, ...ADMIN }).justificar).toBe(true);
    expect(acoesDoPainel({ linha: conferida, rodada: 2, ...ADMIN }).justificar).toBe(true);
  });

  it("a que espera aprovação oferece Aprovar e Rejeitar ao admin e ao gestor, e só o aviso ao analista", () => {
    const aguardando = { ...DIVERGENTE, decisao: decisao("justificada", "pendente") };
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...ADMIN })).toEqual({
      justificar: false,
      aprovar: true,
      avisoDeAprovacao: false,
    });
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...ANALISTA })).toEqual({
      justificar: false,
      aprovar: false,
      avisoDeAprovacao: true,
    });
  });

  it("a justificada aprovada e a que bateu não oferecem nada: desfazer é na janela do detalhe", () => {
    const aprovada = { ...DIVERGENTE, decisao: decisao("justificada", "aprovada") };
    expect(acoesDoPainel({ linha: aprovada, rodada: 1, ...ADMIN })).toEqual({ justificar: false, aprovar: false, avisoDeAprovacao: false });
    const bateu = { ...DIVERGENTE, status: "match_exato" as const };
    expect(acoesDoPainel({ linha: bateu, rodada: 1, ...ADMIN })).toEqual({ justificar: false, aprovar: false, avisoDeAprovacao: false });
  });

  it("sem onde gravar (mês fechado, rodada passada, mock sem decisão) não há ação de decidir, nem aviso de aprovação mudando", () => {
    const aguardando = { ...DIVERGENTE, decisao: decisao("justificada", "pendente") };
    const travado = { podeDecidir: false, podeAprovar: true };
    expect(acoesDoPainel({ linha: DIVERGENTE, rodada: 1, ...travado }).justificar).toBe(false);
    expect(acoesDoPainel({ linha: aguardando, rodada: 1, ...travado }).aprovar).toBe(false);
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

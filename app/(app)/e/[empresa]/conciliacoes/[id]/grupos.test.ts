import { describe, expect, it } from "vitest";
import type { LinhaComparacao } from "@/lib/mock-data";
import { cabecalhoDoGrupo, contarGrupos, juntarGrupos, montarLotes, textoDosLotes } from "./grupos";

const LOTE = { quantidadeBanco: 1, quantidadeSistema: 2, valorUnico: -150000, maiorDesvioDias: 0 };

function linha(id: string, parcial: Partial<LinhaComparacao> = {}): LinhaComparacao {
  return {
    id,
    descricao: id,
    data: "10/09",
    valorBanco: null,
    valorSistema: -5000,
    status: "match_exato",
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

const doBanco = (id: string) => linha(id, { status: "match_agrupado", grupoId: "g1", grupo: LOTE, valorBanco: -150000, valorSistema: null });
const doSistema = (id: string) => linha(id, { status: "match_agrupado", grupoId: "g1", grupo: LOTE });

describe("juntarGrupos (backend #131)", () => {
  it("junta os membros na posição do primeiro, com a ponta única antes dos outros", () => {
    const a = linha("a");
    const b = linha("b");
    const resultado = juntarGrupos([a, doSistema("g1-sist"), b, doBanco("g1-banco"), doSistema("g1-sist2")]);
    expect(resultado.map((l) => l.id)).toEqual(["a", "g1-banco", "g1-sist", "g1-sist2", "b"]);
  });

  it("uma lista sem grupos sai igual, na mesma ordem", () => {
    const lista = [linha("a"), linha("b"), linha("c")];
    expect(juntarGrupos(lista)).toEqual(lista);
  });
});

describe("cabecalhoDoGrupo", () => {
  it("diz o lançamento único, o valor e quantos do outro lado somam ele", () => {
    expect(cabecalhoDoGrupo({ ...LOTE, quantidadeSistema: 10 })).toBe("1 lançamento do banco de R$ 150.000,00 = 10 do sistema");
    expect(cabecalhoDoGrupo({ quantidadeBanco: 3, quantidadeSistema: 1, valorUnico: 900.5, maiorDesvioDias: 0 })).toBe(
      "1 lançamento do sistema de R$ 900,50 = 3 do banco",
    );
  });

  it("acrescenta os dias de diferença quando há", () => {
    expect(cabecalhoDoGrupo({ ...LOTE, quantidadeSistema: 10, maiorDesvioDias: 2 })).toBe(
      "1 lançamento do banco de R$ 150.000,00 = 10 do sistema · até 2 dias de diferença",
    );
    expect(cabecalhoDoGrupo({ ...LOTE, maiorDesvioDias: 1 })).toMatch(/até 1 dia de diferença$/);
  });
});

describe("textoDosLotes e contarGrupos", () => {
  it("diz quantos lotes foram conciliados por soma, e nada sem nenhum", () => {
    expect(textoDosLotes(1)).toBe("1 lote conciliado por soma");
    expect(textoDosLotes(3)).toBe("3 lotes conciliados por soma");
    expect(textoDosLotes(0)).toBeNull();
    expect(textoDosLotes(undefined)).toBeNull();
  });

  it("conta os grupos distintos, não as linhas", () => {
    expect(contarGrupos([doBanco("x"), doSistema("y"), doSistema("z"), linha("a")])).toBe(1);
    expect(contarGrupos([linha("a")])).toBe(0);
  });
});

describe("montarLotes", () => {
  it("separa a ponta única dos membros de cada lote", () => {
    const lotes = montarLotes([doSistema("s1"), linha("solta"), doBanco("b1"), doSistema("s2")]);
    expect(lotes.get("g1")?.ponta.id).toBe("b1");
    expect(lotes.get("g1")?.membros.map((l) => l.id)).toEqual(["s1", "s2"]);
  });

  it("deixa de fora o lote a que falta a ponta ou os membros", () => {
    expect(montarLotes([doSistema("s1")]).size).toBe(0);
    expect(montarLotes([doBanco("b1")]).size).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import type { Execucao } from "@/lib/adaptadores";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import type { VisaoGeral } from "../conciliacoes/acoes";
import { montarContexto, responder, saudacao, sugestoes, type Contexto } from "./respostas";

function linha(id: string, status: StatusLinha, valorBanco: number | null, valorSistema: number | null): LinhaComparacao {
  return {
    id,
    descricao: `Lançamento ${id}`,
    data: "04/09",
    dataISO: "2026-09-04",
    valorBanco,
    valorSistema,
    status,
    explicacao: null,
    historico: [],
  };
}

const EXECUCAO = { id: "e1", executadaEm: "2026-09-24T17:02:11Z" } as Execucao;

function visao(linhas: LinhaComparacao[], naoLidas: VisaoGeral["arquivosComLinhasNaoLidas"] = []): VisaoGeral {
  return {
    execucoes: [EXECUCAO],
    total: 1,
    recente: {
      execucao: EXECUCAO,
      conciliacao: { id: "banco-1", extratoSistemaId: "sistema-1", mes: "Setembro/2026", status: "em_andamento", linhas },
    },
    arquivosComLinhasNaoLidas: naoLidas,
  };
}

const LINHAS = [
  linha("l1", "match_exato", 100, 100),
  linha("l2", "match_exato", 200, 200),
  linha("l3", "match_tolerancia", 300, 300),
  linha("l4", "sem_correspondencia", 4180, null),
  linha("l5", "divergente_valor", -12640, -12604),
  linha("l6", "tarifa_bancaria", -45, null),
];

/** O Intl separa "R$" do valor com espaço não separável. */
function texto(pergunta: string, ctx: Contexto): string {
  return responder(pergunta, ctx).texto.replaceAll("\u00a0", " ");
}

function contexto(linhas = LINHAS, naoLidas: VisaoGeral["arquivosComLinhasNaoLidas"] = []): Contexto {
  return montarContexto(visao(linhas, naoLidas))!;
}

describe("montarContexto", () => {
  it("não tem contexto sem conciliação", () => {
    expect(montarContexto({ execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] })).toBeNull();
  });

  it("lê o mês e os números da conciliação mais recente", () => {
    expect(contexto()).toMatchObject({
      mes: "setembro",
      Mes: "Setembro",
      processados: 6,
      batidos: 3,
      taxa: 50,
      divergentes: 3,
      valorAberto: 4261,
      caminho: "/conciliacoes/banco-1?sistema=sistema-1",
    });
  });

  it("aponta a divergência que mais deixa dinheiro em aberto, com o link direto para ela", () => {
    expect(contexto().maior).toEqual({
      id: "l4",
      descricao: "Lançamento l4",
      rotulo: "Sem correspondência no sistema",
      valor: 4180,
      href: "/conciliacoes/banco-1/l4?sistema=sistema-1",
    });
  });
});

describe("saudacao e sugestoes", () => {
  it("abrem com o mês em uma frase e os atalhos do design com os números de agora", () => {
    expect(saudacao(contexto())).toBe(
      "Setembro está 50,0% conciliado. Sobraram 3 linhas para revisar, a maior parte em “Valor diverge na mesma data”.",
    );
    expect(sugestoes(contexto()).map((item) => item.replaceAll("\u00a0", " "))).toEqual([
      "Por que sobrou R$ 4.261?",
      "Resumo de setembro",
      "O que falta para fechar?",
      "Explique a maior divergência",
    ]);
  });

  it("não sugerem explicar nem perguntar o que sobrou quando nada sobrou", () => {
    const tudoCasado = contexto([linha("l1", "match_exato", 100, 100)]);
    expect(saudacao(tudoCasado)).toBe("Setembro está 100,0% conciliado. Nada sobrou para revisar.");
    expect(sugestoes(tudoCasado)).toEqual(["Resumo de setembro", "O que falta para fechar?"]);
  });
});

describe("responder", () => {
  it("resume o mês com os números reais", () => {
    const resposta = responder("Resumo de setembro", contexto());
    expect(texto("Resumo de setembro", contexto())).toBe(
      "Setembro: 6 lançamentos. 3 casaram sozinhos — 50,0%. Ficaram R$ 4.261 em aberto, em 3 linhas.",
    );
    expect(resposta.link).toEqual({ href: "/conciliacoes/banco-1?sistema=sistema-1", rotulo: "Abrir a conciliação" });
  });

  it("diz de onde sai o dinheiro em aberto, grupo a grupo", () => {
    expect(texto("Por que sobrou R$ 4.261?", contexto())).toBe(
      "Os R$ 4.261 em aberto saem de 3 linhas — Valor diverge na mesma data: 1 (R$ 36); Sem correspondência no sistema: 1 (R$ 4.180) e Tarifa bancária: 1 (R$ 45).",
    );
  });

  it("diz o que falta para fechar, começando pelo que mais pesa", () => {
    const resposta = responder("o que falta pra fechar", contexto());
    expect(texto("o que falta pra fechar", contexto())).toBe(
      "Faltam 3 decisões suas. Comece por “Sem correspondência no sistema”: 1 linha, R$ 4.180 dos R$ 4.261 em aberto.",
    );
    // a categoria inteira, como o "Revisar" do hub; só a explicação aponta uma linha
    expect(resposta.link).toEqual({
      href: "/conciliacoes/banco-1?sistema=sistema-1&status=sem_correspondencia",
      rotulo: "Revisar",
    });
  });

  it("lembra das linhas não lidas, que ficam fora da conta", () => {
    const resposta = responder("falta algo?", contexto(LINHAS, [{ nome: "erp.csv", linhas: 2 }]));
    expect(resposta.texto).toContain("Atenção: 2 linhas de erp.csv não foram lidas e ficaram fora da conta.");
  });

  it("diz que o mês está pronto quando nada pede decisão", () => {
    const resposta = responder("O que falta para fechar?", contexto([linha("l1", "match_exato", 100, 100)]));
    expect(resposta).toEqual({
      texto: "Nada: setembro está pronto para fechar.",
      link: { href: "/fechamentos", rotulo: "Ir aos fechamentos" },
    });
  });

  it("fala das tarifas e das duplicidades, ou diz que não há", () => {
    expect(texto("e as tarifas?", contexto())).toMatch(/^1 tarifa bancária em setembro, somando R\$ 45\./);
    expect(responder("tem duplicidade?", contexto()).texto).toBe("Nenhuma possível duplicidade em setembro.");
  });

  it("entende a pergunta sem acento", () => {
    expect(texto("divergencias", contexto())).toMatch(/^Os R\$ 4\.261 em aberto/);
  });

  it("pede a explicação à IA só quando há divergência para explicar", () => {
    expect(responder("Explique a maior divergência", contexto())).toEqual({ texto: "", explicar: true });
    expect(responder("explica", contexto([linha("l1", "match_exato", 100, 100)])).texto).toBe(
      "Nenhuma divergência em aberto em setembro: não há o que explicar.",
    );
  });

  it("diz o que sabe responder quando não entende, em vez de inventar", () => {
    expect(responder("qual a previsão do tempo?", contexto()).texto).toMatch(/^Por enquanto eu respondo sobre setembro/);
  });
});

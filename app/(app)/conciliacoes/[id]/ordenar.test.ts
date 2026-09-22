import { describe, it, expect } from "vitest";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import { filtrarLinhas, ordenarLinhas } from "./ordenar";

function linha(
  id: string,
  data: string,
  descricao: string,
  valorBanco: number | null,
  valorSistema: number | null,
  status: StatusLinha = "batido",
): LinhaComparacao {
  return { id, descricao, data, valorBanco, valorSistema, status, explicacao: null, historico: [] };
}

const lista = [
  linha("b", "15/09", "Folha de pagamento", 48200, 48200),
  linha("a", "04/09", "Aço Norte", 12640, 12604, "divergencia_valor"),
  linha("c", "02/10", "Energia elétrica", 2104, 2104),
  linha("d", "08/09", "TED sem par", 3150, null, "somente_banco"),
];

describe("ordenarLinhas", () => {
  it("não muta a lista recebida", () => {
    const antes = lista.map((l) => l.id);
    ordenarLinhas(lista, { coluna: "data", crescente: true });
    expect(lista.map((l) => l.id)).toEqual(antes);
  });

  it("ordena por data respeitando o mês, não a ordem do texto", () => {
    const ids = ordenarLinhas(lista, { coluna: "data", crescente: true }).map((l) => l.id);
    // 02/10 vem depois de 15/09, embora "02" seja menor que "15" como texto
    expect(ids).toEqual(["a", "d", "b", "c"]);
  });

  it("inverte a ordem por data", () => {
    const ids = ordenarLinhas(lista, { coluna: "data", crescente: false }).map((l) => l.id);
    expect(ids).toEqual(["c", "b", "d", "a"]);
  });

  it("ordena descrição em pt-BR, ignorando caixa e acento", () => {
    const ids = ordenarLinhas(lista, { coluna: "descricao", crescente: true }).map((l) => l.id);
    expect(ids).toEqual(["a", "c", "b", "d"]);
  });

  it("ordena por valor numericamente", () => {
    const ids = ordenarLinhas(lista, { coluna: "valorBanco", crescente: true }).map((l) => l.id);
    expect(ids).toEqual(["c", "d", "a", "b"]);
  });

  it("joga a linha sem valor para o fim, nas duas direções", () => {
    const crescente = ordenarLinhas(lista, { coluna: "valorSistema", crescente: true });
    const decrescente = ordenarLinhas(lista, { coluna: "valorSistema", crescente: false });
    expect(crescente.at(-1)?.id).toBe("d");
    expect(decrescente.at(-1)?.id).toBe("d");
  });

  it("ordena por status pelo rótulo que aparece na tela", () => {
    const rotulos = ordenarLinhas(lista, { coluna: "status", crescente: true }).map((l) => l.status);
    // "Divergência de valor" < "Match exato" < "Sem correspondência no sistema"
    expect(rotulos).toEqual(["divergencia_valor", "batido", "batido", "somente_banco"]);
  });

  it("aguenta data malformada sem quebrar a ordenação", () => {
    const comLixo = [...lista, linha("x", "sem data", "Estranho", 1, 1)];
    expect(() => ordenarLinhas(comLixo, { coluna: "data", crescente: true })).not.toThrow();
    expect(ordenarLinhas(comLixo, { coluna: "data", crescente: true })).toHaveLength(5);
  });
});

describe("filtrarLinhas", () => {
  it("devolve tudo em 'todos'", () => {
    expect(filtrarLinhas(lista, "todos")).toHaveLength(4);
  });

  it("esconde as linhas que já bateram em 'revisão'", () => {
    const ids = filtrarLinhas(lista, "revisao").map((l) => l.id);
    expect(ids).toEqual(["a", "d"]);
  });
});

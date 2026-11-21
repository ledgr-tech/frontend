import { describe, expect, it } from "vitest";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import { limparSelecao, podeSelecionar, somarLinhas } from "./selecao";

function linha(
  parcial: Partial<LinhaComparacao> = {},
): LinhaComparacao {
  return {
    id: "l",
    descricao: "Linha",
    data: "06/07",
    valorBanco: null,
    valorSistema: null,
    status: "divergente_valor",
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

describe("somarLinhas", () => {
  it("soma a tarifa do cliente nos dois lados em centavos", () => {
    const linhas = [
      linha({ id: "a", status: "sem_correspondencia", valorSistema: -2.4 }),
      linha({ id: "b", status: "sem_correspondencia", valorBanco: -1.6 }),
      linha({ id: "c", status: "sem_correspondencia", valorBanco: -0.8 }),
    ];

    expect(somarLinhas(linhas)).toEqual({
      quantidade: 3,
      banco: -240,
      sistema: -240,
      diferenca: 0,
    });
  });

  it("soma apenas o banco", () => {
    expect(somarLinhas([
      linha({ valorBanco: 100.5, valorSistema: null }),
    ])).toEqual({ quantidade: 1, banco: 10050, sistema: 0, diferenca: 10050 });
  });

  it("soma apenas o sistema e deixa a diferença negativa", () => {
    expect(somarLinhas([
      linha({ valorBanco: null, valorSistema: 100.5 }),
    ])).toEqual({ quantidade: 1, banco: 0, sistema: 10050, diferenca: -10050 });
  });

  it("não acumula resíduo de float", () => {
    expect(somarLinhas([
      linha({ id: "a", valorBanco: 0.1 }),
      linha({ id: "b", valorBanco: 0.2 }),
    ]).banco).toBe(30);
  });

  it("arredonda cada linha antes de somar: 0,10 + 0,19 contra 0,29 fecha em zero, dos dois lados", () => {
    // 0.29 * 100 dá 28,999…: sem arredondar cada lado, a diferença sobra e o "Fecha" nunca aparece
    const somaDe = (banco: number[], sistema: number[]) =>
      somarLinhas([...banco.map((v) => linha({ valorBanco: v })), ...sistema.map((v) => linha({ valorSistema: v }))]);
    expect(somaDe([0.1, 0.19], [0.29])).toEqual({ quantidade: 3, banco: 29, sistema: 29, diferenca: 0 });
    expect(somaDe([0.29], [0.1, 0.19])).toEqual({ quantidade: 3, banco: 29, sistema: 29, diferenca: 0 });
  });

  it("mede a diferença quando os dois lados existem", () => {
    expect(somarLinhas([
      linha({ valorBanco: 100, valorSistema: 98 }),
    ]).diferenca).toBe(200);
  });

  it("zera tudo numa lista vazia", () => {
    expect(somarLinhas([])).toEqual({
      quantidade: 0,
      banco: 0,
      sistema: 0,
      diferenca: 0,
    });
  });
});

describe("podeSelecionar", () => {
  it.each(["match_exato", "match_tolerancia", "match_agrupado"] as StatusLinha[])(
    "não aceita status resolvido %s",
    (status) => expect(podeSelecionar(linha({ status }))).toBe(false),
  );

  it("aceita divergente_valor e sem_correspondencia", () => {
    expect(podeSelecionar(linha({ status: "divergente_valor" }))).toBe(true);
    expect(podeSelecionar(linha({ status: "sem_correspondencia" }))).toBe(true);
  });
});

describe("limparSelecao", () => {
  it("mantém só as chaves existentes que ainda podem ser selecionadas, na ordem das linhas", () => {
    const linhas = [
      linha({ id: "faltou", status: "match_exato" }),
      linha({ id: "continua", status: "divergente_valor", chave: "chave-continua" }),
      linha({ id: "virou-batida", status: "match_exato", chave: "chave-batida" }),
    ];

    expect(limparSelecao(
      new Set(["chave-batida", "chave-faltando", "chave-continua"]),
      linhas,
    )).toEqual(["chave-continua"]);
  });
});

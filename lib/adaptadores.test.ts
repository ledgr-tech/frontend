import { describe, it, expect } from "vitest";
import {
  adaptarConciliacao,
  adaptarLinha,
  pareceUuid,
  type ItemConciliacaoAPI,
  type ListaConciliacaoAPI,
} from "./adaptadores";

function item(parcial: Partial<ItemConciliacaoAPI> = {}): ItemConciliacaoAPI {
  return {
    id: "c1",
    extrato_sistema_id: "e-sistema",
    status: "match_exato",
    regra_aplicada: "exata",
    score_confianca: "1.00",
    lancamento_banco: {
      id: "lb-1",
      data: "2026-09-04",
      valor: "12640.00",
      descricao: "Boleto Aço Norte",
      tipo: "debito",
    },
    lancamento_sistema: {
      id: "ls-1",
      data: "2026-09-04",
      valor: "12640.00",
      descricao: "Boleto Aço Norte",
      tipo: "debito",
    },
    ...parcial,
  };
}

describe("adaptarLinha", () => {
  it("converte o decimal em string para número e a data para DD/MM", () => {
    const linha = adaptarLinha(item());
    expect(linha.valorBanco).toBe(12640);
    expect(linha.valorSistema).toBe(12640);
    expect(linha.data).toBe("04/09");
    // a data completa fica junto: é ela que ordena certo quando o extrato
    // atravessa a virada do ano
    expect(linha.dataISO).toBe("2026-09-04");
  });

  it("deixa null o lado que o motor não pareou", () => {
    // as cinco categorias de divergência descrevem um lançamento só: o backend
    // sub-classifica a sobra olhando o outro extrato, mas não forma par
    const linha = adaptarLinha(
      item({
        status: "divergente_valor",
        regra_aplicada: null,
        score_confianca: null,
        lancamento_sistema: null,
      }),
    );
    expect(linha.valorBanco).toBe(12640);
    expect(linha.valorSistema).toBeNull();
    expect(linha.explicacao).toBeNull();
    expect(linha.camposSistema).toBeUndefined();
  });

  it("usa o lançamento do sistema quando o banco não tem a linha", () => {
    const linha = adaptarLinha(
      item({
        status: "sem_correspondencia",
        regra_aplicada: null,
        score_confianca: null,
        lancamento_banco: null,
      }),
    );
    expect(linha.descricao).toBe("Boleto Aço Norte");
    expect(linha.valorBanco).toBeNull();
    expect(linha.dataISO).toBe("2026-09-04");
  });

  it("explica o match com a regra e a confiança que o backend devolveu", () => {
    const linha = adaptarLinha(
      item({ status: "match_tolerancia", regra_aplicada: "tolerancia", score_confianca: "0.67" }),
    );
    expect(linha.explicacao).toBe('Conciliado pela regra "tolerancia". Confiança de 67%.');
  });

  it("não inventa histórico: o backend não guarda linha do tempo por lançamento", () => {
    expect(adaptarLinha(item()).historico).toEqual([]);
  });
});

describe("adaptarConciliacao", () => {
  const lista: ListaConciliacaoAPI = {
    extrato_id: "e-banco",
    total: 2,
    limit: 100,
    offset: 0,
    itens: [item(), item({ id: "c2", status: "tarifa_bancaria", lancamento_sistema: null })],
  };

  it("mantém o id do extrato do banco como id da conciliação", () => {
    expect(adaptarConciliacao(lista).id).toBe("e-banco");
  });

  it("tira a competência da primeira data com ano", () => {
    expect(adaptarConciliacao(lista).mes).toBe("Setembro/2026");
  });

  it("sobrevive a uma conciliação vazia", () => {
    const vazia = adaptarConciliacao({ ...lista, total: 0, itens: [] });
    expect(vazia.linhas).toEqual([]);
    expect(vazia.mes).toBe("Conciliação");
  });
});

describe("pareceUuid", () => {
  it("separa id do backend de id do mock", () => {
    expect(pareceUuid("3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20")).toBe(true);
    expect(pareceUuid("conc-1")).toBe(false);
  });
});

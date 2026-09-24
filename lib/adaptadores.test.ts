import { describe, it, expect } from "vitest";
import {
  adaptarConciliacao,
  adaptarExecucao,
  adaptarLinha,
  extratosDasExecucoes,
  pareceUuid,
  type Execucao,
  type ExecucaoAPI,
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

/** Uma execução como `GET /execucoes` devolve (ItemExecucaoResponse no backend). */
function execucao(parcial: Partial<ExecucaoAPI> = {}): ExecucaoAPI {
  return {
    id: "a1b2c3d4-0000-4000-8000-000000000001",
    extrato_banco_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
    extrato_sistema_id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
    nome_arquivo_banco: "sicredi-setembro.ofx",
    nome_arquivo_sistema: "erp-setembro.csv",
    executada_em: "2026-09-24T17:02:11.482913Z",
    tolerancia_dias: 2,
    contagens: {
      total: 4218,
      match_exato: 3900,
      match_tolerancia: 162,
      duplicado: 4,
      sem_correspondencia: 98,
      tarifa_bancaria: 21,
      divergente_valor: 22,
      divergente_data: 11,
    },
    percentual_acerto: "96.30",
    atual: true,
    ...parcial,
  };
}

describe("adaptarExecucao", () => {
  it("traz o que a tela mostra de cada execução", () => {
    expect(adaptarExecucao(execucao())).toEqual({
      id: "a1b2c3d4-0000-4000-8000-000000000001",
      extratoBancoId: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
      extratoSistemaId: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
      arquivoBanco: "sicredi-setembro.ofx",
      arquivoSistema: "erp-setembro.csv",
      executadaEm: "2026-09-24T17:02:11.482913Z",
      lancamentos: 4218,
      acerto: 96.3,
      atual: true,
    });
  });

  it("aceita o percentual como número, caso o backend deixe de mandar string", () => {
    expect(adaptarExecucao(execucao({ percentual_acerto: 87.5 })).acerto).toBe(87.5);
  });

  it("não inventa percentual para execução sem lançamento", () => {
    // o backend devolve null quando total é zero: não existe acerto de nada
    expect(adaptarExecucao(execucao({ percentual_acerto: null })).acerto).toBeNull();
  });

  it("marca a execução refeita depois como não atual", () => {
    expect(adaptarExecucao(execucao({ atual: false })).atual).toBe(false);
  });
});

describe("extratosDasExecucoes", () => {
  function rodada(
    id: string,
    banco: [string, string],
    sistema: [string, string],
    executadaEm: string,
  ): Execucao {
    return {
      id,
      extratoBancoId: banco[0],
      arquivoBanco: banco[1],
      extratoSistemaId: sistema[0],
      arquivoSistema: sistema[1],
      executadaEm,
      lancamentos: 10,
      acerto: 90,
      atual: true,
    };
  }

  // da mais recente para a mais antiga, como /execucoes devolve
  const execucoes = [
    rodada("e3", ["b-set", "sicredi-set.ofx"], ["s-set-v2", "erp-set-v2.csv"], "2026-09-24T17:00:00Z"),
    rodada("e2", ["b-set", "sicredi-set.ofx"], ["s-set", "erp-set.csv"], "2026-09-23T12:00:00Z"),
    rodada("e1", ["b-ago", "sicredi-ago.ofx"], ["s-ago", "erp-ago.csv"], "2026-09-02T19:00:00Z"),
  ];

  it("lista cada arquivo uma vez só, do uso mais recente para o mais antigo", () => {
    expect(extratosDasExecucoes(execucoes).map((arquivo) => arquivo.id)).toEqual([
      "b-set",
      "s-set-v2",
      "s-set",
      "b-ago",
      "s-ago",
    ]);
  });

  it("guarda a origem, o nome e a conciliação mais recente de cada arquivo", () => {
    const [bancoSetembro, sistemaNovo, sistemaAntigo] = extratosDasExecucoes(execucoes);
    expect(bancoSetembro).toEqual({
      id: "b-set",
      nome: "sicredi-set.ofx",
      origem: "banco",
      conciliadoEm: "2026-09-24T17:00:00Z",
      resultado: "/conciliacoes/b-set",
    });
    expect(sistemaNovo.origem).toBe("sistema");
    // o resultado de um extrato do sistema abre pelo extrato do banco da mesma rodada
    expect(sistemaAntigo).toMatchObject({
      nome: "erp-set.csv",
      conciliadoEm: "2026-09-23T12:00:00Z",
      resultado: "/conciliacoes/b-set",
    });
  });

  it("não tem arquivo nenhum sem execução", () => {
    expect(extratosDasExecucoes([])).toEqual([]);
  });
});

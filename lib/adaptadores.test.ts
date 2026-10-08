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

  it("mostra só o começo do id do lançamento, que é do Ledgr e não do banco", () => {
    const linha = adaptarLinha(
      item({
        lancamento_banco: {
          id: "3cf85879-9a0d-4448-992e-d123a5c374cd",
          data: "2026-09-04",
          valor: "12640.00",
          descricao: "Boleto",
          tipo: "debito",
        },
      }),
    );
    expect(linha.camposBanco?.find((campo) => campo.rotulo === "Identificador")?.valor).toBe("3cf85879");
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

  it("guarda a data e a descrição do sistema, que podem não ser as do banco", () => {
    // tolerância de data: o mesmo pagamento caiu um dia depois no ERP, com outro nome
    const linha = adaptarLinha(
      item({
        status: "match_tolerancia",
        lancamento_sistema: {
          id: "ls-1",
          data: "2026-09-05",
          valor: "12640.00",
          descricao: "Pagamento fornecedor Aço Norte",
          tipo: "debito",
        },
      }),
    );
    expect(linha.data).toBe("04/09");
    expect(linha.descricao).toBe("Boleto Aço Norte");
    expect(linha.dataSistema).toBe("05/09");
    expect(linha.descricaoSistema).toBe("Pagamento fornecedor Aço Norte");
  });

  it("não tem data nem descrição do sistema quando o sistema não tem a linha", () => {
    const linha = adaptarLinha(item({ lancamento_sistema: null }));
    expect(linha.dataSistema).toBeUndefined();
    expect(linha.descricaoSistema).toBeUndefined();
  });

  it("explica o match com a regra e a confiança que o backend devolveu", () => {
    const linha = adaptarLinha(
      item({ status: "match_tolerancia", regra_aplicada: "tolerancia", score_confianca: "0.67" }),
    );
    expect(linha.explicacao).toBe('Conciliado pela regra "tolerancia". Confiança de 67%.');
    expect(linha.explicacaoPorIa).toBe(false);
  });

  it("mostra a explicação que o backend gerou na conciliação, com o selo quando veio da IA", () => {
    const divergente = item({
      status: "divergente_valor",
      regra_aplicada: null,
      score_confianca: null,
      explicacao: "O banco cobrou R$ 36 de juros pelo atraso, que o sistema não lançou.",
      gerada_por_ia: true,
    });
    const linha = adaptarLinha(divergente);
    expect(linha.explicacao).toBe("O banco cobrou R$ 36 de juros pelo atraso, que o sistema não lançou.");
    expect(linha.explicacaoPorIa).toBe(true);

    // o texto fixo do motor, quando a IA não respondeu, sai sem o selo
    expect(adaptarLinha({ ...divergente, gerada_por_ia: false }).explicacaoPorIa).toBe(false);
  });

  it("lê a decisão e os eventos que o backend mandar", () => {
    const decisao = {
      tipo: "justificada" as const,
      texto: "Juros de dois dias de atraso.",
      autor: "Eduardo Sichelero",
      em: "2026-09-30T13:12:00Z",
      rodada: 2,
    };
    const eventos = [{ ...decisao, tipo: "conferida" as const, texto: null, rodada: 1 }, decisao];
    const linha = adaptarLinha(item({ status: "divergente_valor", decisao, eventos }));
    expect(linha.decisao).toEqual(decisao);
    expect(linha.eventos).toEqual(eventos);
    // sem decisão nenhuma ainda, o backend manda null: a tela sabe que pode decidir
    expect(adaptarLinha(item({ decisao: null })).decisao).toBeNull();
  });

  it("sem o campo, a linha não tem decisão (undefined, não null)", () => {
    const linha = adaptarLinha(item());
    expect(linha.decisao).toBeUndefined();
    expect("decisao" in linha).toBe(false);
  });

  it("diz que não há descrição quando o extrato não trouxe uma, nos dois lados", () => {
    // OFX sem MEMO: a descrição chega vazia, e a linha não pode ficar sem ter onde clicar
    const linha = adaptarLinha(
      item({
        lancamento_banco: { ...item().lancamento_banco!, descricao: "" },
        lancamento_sistema: { ...item().lancamento_sistema!, descricao: "   " },
      }),
    );
    expect(linha.descricao).toBe("Sem descrição");
    expect(linha.descricaoSistema).toBe("Sem descrição");
  });

  it("prefere a explicação do backend à frase da regra, e ignora uma explicação em branco", () => {
    expect(adaptarLinha(item({ explicacao: "Mesmo boleto nos dois lados.", gerada_por_ia: true })).explicacao).toBe(
      "Mesmo boleto nos dois lados.",
    );
    const emBranco = adaptarLinha(item({ explicacao: "  ", gerada_por_ia: true }));
    expect(emBranco.explicacao).toBe('Conciliado pela regra "exata". Confiança de 100%.');
    expect(emBranco.explicacaoPorIa).toBe(false);
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

  describe("a chave de cada linha, a mesma em todas as rodadas", () => {
    const soDoSistema = (id: string, descricao = "  Estorno  Maquininha ") =>
      item({
        id,
        status: "sem_correspondencia",
        lancamento_banco: null,
        lancamento_sistema: { id: `ls-${id}`, data: "2026-09-12", valor: "-980", descricao, tipo: "debito" },
      });
    const comItens = (itens: ItemConciliacaoAPI[]) => adaptarConciliacao({ ...lista, total: itens.length, itens });

    it("a chave é o lançamento do banco, que é o mesmo em todas as rodadas", () => {
      expect(comItens([item()]).linhas[0].chave).toBe("b:lb-1");
    });

    it("sem banco, a chave é data, valor e descrição do sistema", () => {
      expect(comItens([soDoSistema("c1")]).linhas[0].chave).toBe("s:2026-09-12|-980.00|estorno maquininha");
    });

    it("duas linhas só do sistema iguais não dividem a chave", () => {
      expect(comItens([soDoSistema("c1"), soDoSistema("c2", "Estorno maquininha")]).linhas.map((l) => l.chave)).toEqual([
        "s:2026-09-12|-980.00|estorno maquininha",
        "s:2026-09-12|-980.00|estorno maquininha#2",
      ]);
    });

    it("prefere a chave que o backend mandar", () => {
      expect(comItens([item({ chave: "k-1" })]).linhas[0].chave).toBe("k-1");
    });

    it("monta a chave de uma linha só do sistema sem descrição, sem derrubar a conciliação", () => {
      // a descrição nula é a mesma que o adaptador já trata como "Sem descrição"
      const semDescricao = soDoSistema("c1", null as unknown as string);
      const conciliacao = comItens([semDescricao]);
      expect(conciliacao.linhas[0].chave).toBe("s:2026-09-12|-980.00|");
      expect(conciliacao.linhas[0].descricao).toBe("Sem descrição");
    });
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
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-09-30",
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
      divergencias: {
        duplicado: 4,
        sem_correspondencia: 98,
        tarifa_bancaria: 21,
        divergente_valor: 22,
        divergente_data: 11,
      },
      toleranciaDias: 2,
      atual: true,
      // o backend que ainda não guarda decisões não manda a contagem: nenhuma justificada
      justificadas: 0,
      periodoInicio: "2026-09-01",
    });
  });

  it("não inventa período para extrato do banco que ainda não tem, nem para backend que não o manda", () => {
    expect(adaptarExecucao(execucao({ periodo_inicio: null })).periodoInicio).toBeNull();
    const semPeriodo = execucao();
    delete semPeriodo.periodo_inicio;
    expect(adaptarExecucao(semPeriodo).periodoInicio).toBeNull();
  });

  it("lê quantas divergências estão justificadas", () => {
    const comJustificadas = execucao();
    comJustificadas.contagens = { ...comJustificadas.contagens, justificadas: 3 };
    expect(adaptarExecucao(comJustificadas).justificadas).toBe(3);
  });

  it("deixa de fora das divergências as categorias sem nenhuma linha", () => {
    const tudoCasado = execucao({
      contagens: {
        total: 10,
        match_exato: 9,
        match_tolerancia: 0,
        duplicado: 0,
        sem_correspondencia: 1,
        tarifa_bancaria: 0,
        divergente_valor: 0,
        divergente_data: 0,
      },
    });
    expect(adaptarExecucao(tudoCasado).divergencias).toEqual({ sem_correspondencia: 1 });
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
      divergencias: {},
      toleranciaDias: 1,
      atual: true,
      justificadas: 0,
      periodoInicio: null,
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
    // o extrato do banco é a conciliação: abre pelo endereço só dele, na rodada que vale
    expect(bancoSetembro).toEqual({
      id: "b-set",
      nome: "sicredi-set.ofx",
      origem: "banco",
      conciliadoEm: "2026-09-24T17:00:00Z",
      resultado: "/conciliacoes/b-set",
    });
    expect(sistemaNovo.origem).toBe("sistema");
    // o extrato do banco de setembro entrou em dois pares: cada arquivo do
    // sistema abre o seu, e não as linhas dos dois misturadas
    expect(sistemaAntigo).toMatchObject({
      nome: "erp-set.csv",
      conciliadoEm: "2026-09-23T12:00:00Z",
      resultado: "/conciliacoes/b-set?sistema=s-set",
    });
  });

  it("diz em que rodada cada extrato do sistema entrou, e quantas a conciliação tem", () => {
    const [, sistemaNovo, sistemaAntigo, , sistemaAgosto] = extratosDasExecucoes(execucoes);
    expect(sistemaNovo.rodada).toEqual({ numero: 2, total: 2 });
    expect(sistemaAntigo.rodada).toEqual({ numero: 1, total: 2 });
    expect(sistemaAgosto.rodada).toEqual({ numero: 1, total: 1 });
  });

  it("não tem arquivo nenhum sem execução", () => {
    expect(extratosDasExecucoes([])).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecucaoAPI, ItemConciliacaoAPI } from "@/lib/adaptadores";
import { ErroBackend } from "@/lib/backend";
import {
  carregarConciliacao,
  carregarConciliacaoEmRodadas,
  carregarFechamentos,
  carregarHistorico,
  carregarPainel,
  carregarVisaoGeral,
  explicarDivergencia,
  listarExecucoes,
  listarExtratos,
  registrarDecisao,
  situacaoDoExtrato,
} from "./acoes";

// A rede é a fronteira: o que se testa é o caminho pedido e o que as actions
// fazem com a resposta. ErroBackend e a tradução de erro rodam de verdade.
const chamarBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
}));

const BANCO_RECENTE = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const BANCO_ANTERIOR = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

function execucao(id: string, extratoBancoId: string, atual = true): ExecucaoAPI {
  return {
    id,
    extrato_banco_id: extratoBancoId,
    extrato_sistema_id: SISTEMA,
    nome_arquivo_banco: `${id}-banco.ofx`,
    nome_arquivo_sistema: `${id}-sistema.csv`,
    executada_em: "2026-09-24T17:02:11Z",
    tolerancia_dias: 2,
    contagens: {
      total: 2,
      match_exato: 1,
      match_tolerancia: 0,
      duplicado: 0,
      sem_correspondencia: 1,
      tarifa_bancaria: 0,
      divergente_valor: 0,
      divergente_data: 0,
    },
    percentual_acerto: "50.00",
    atual,
  };
}

const itemConciliacao: ItemConciliacaoAPI = {
  id: "c-1",
  extrato_sistema_id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
  status: "sem_correspondencia",
  regra_aplicada: null,
  score_confianca: null,
  lancamento_banco: {
    id: "lb-1",
    data: "2026-09-04",
    valor: "4180.00",
    descricao: "Transferência recebida",
    tipo: "credito",
  },
  lancamento_sistema: null,
};

const SISTEMA_V1 = "1a1a1a1a-1e3f-4a5b-8c6d-9e0f1a2b3c4d";
const SISTEMA_V2 = "2b2b2b2b-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

/**
 * O mesmo extrato do banco em duas rodadas: a v1 do sistema em 23/09 e a v2 em 24/09,
 * as duas `atual` do próprio par. Da mais recente para a mais antiga, como o backend.
 */
function duasRodadas(): ExecucaoAPI[] {
  return [
    { ...execucao("e-v2", BANCO_RECENTE), extrato_sistema_id: SISTEMA_V2, executada_em: "2026-09-24T17:02:11Z" },
    { ...execucao("e-v1", BANCO_RECENTE), extrato_sistema_id: SISTEMA_V1, executada_em: "2026-09-23T12:00:00Z" },
  ];
}

/** O backend com as duas rodadas: linhas, situação dos arquivos e execuções. */
function backendComRodadas(execucoes: ExecucaoAPI[] = duasRodadas()) {
  chamarBackend.mockImplementation(async (caminho: string) => {
    if (caminho.startsWith("/execucoes")) return { total: execucoes.length, limit: 50, offset: 0, itens: execucoes };
    if (caminho.startsWith(`/conciliacoes/${BANCO_RECENTE}`)) {
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
    }
    if (caminho.startsWith("/extratos/")) {
      const id = caminho.replace("/extratos/", "");
      return { extrato_id: id, status: "concluido", origem: "banco", quantidade_lancamentos: 2, erros: [] };
    }
    throw new Error(`caminho inesperado: ${caminho}`);
  });
}

/** Responde como o backend, pelo caminho pedido. */
function backendCom(execucoes: ExecucaoAPI[]) {
  chamarBackend.mockImplementation(async (caminho: string) => {
    if (caminho.startsWith("/execucoes")) {
      return { total: execucoes.length, limit: 50, offset: 0, itens: execucoes };
    }
    if (caminho.startsWith(`/conciliacoes/${BANCO_RECENTE}`)) {
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
    }
    throw new Error(`caminho inesperado: ${caminho}`);
  });
}

describe("listarExecucoes", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("pede as execuções mais recentes e devolve já adaptadas, com o total", async () => {
    backendCom([execucao("e-2", BANCO_RECENTE), execucao("e-1", BANCO_ANTERIOR)]);

    const resultado = await listarExecucoes();

    expect(chamarBackend).toHaveBeenCalledWith("/execucoes?limit=50&offset=0");
    expect(resultado).toMatchObject({
      ok: true,
      dados: {
        total: 2,
        execucoes: [
          { id: "e-2", extratoBancoId: BANCO_RECENTE, acerto: 50 },
          { id: "e-1", extratoBancoId: BANCO_ANTERIOR, acerto: 50 },
        ],
      },
    });
  });

  it("vira a página em offset de 50, e não deixa página inválida chegar ao backend", async () => {
    backendCom([]);

    await listarExecucoes(2);
    expect(chamarBackend).toHaveBeenLastCalledWith("/execucoes?limit=50&offset=100");

    await listarExecucoes(-1);
    expect(chamarBackend).toHaveBeenLastCalledWith("/execucoes?limit=50&offset=0");

    await listarExecucoes(1.5);
    expect(chamarBackend).toHaveBeenLastCalledWith("/execucoes?limit=50&offset=0");
  });

  it("traduz a sessão vencida para a mensagem da tela", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token expirado"));

    expect(await listarExecucoes()).toEqual({
      ok: false,
      status: 401,
      erro: "Sua sessão expirou. Entre de novo para continuar.",
    });
  });
});

describe("carregarHistorico", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  /** A página com uma execução por extrato do banco; a primeira linha de cada um, pela data pedida. */
  function backendDoHistorico(datas: Record<string, string>) {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return { total: 52, limit: 50, offset: 50, itens: [execucao("e-2", BANCO_RECENTE), execucao("e-1", BANCO_ANTERIOR)] };
      }
      const banco = caminho.slice("/conciliacoes/".length, caminho.indexOf("?"));
      const data = datas[banco];
      if (!data) throw new ErroBackend(500, "O servidor respondeu 500.");
      const item = { ...itemConciliacao, lancamento_banco: { ...itemConciliacao.lancamento_banco!, data } };
      return { extrato_id: banco, total: 1, limit: 1, offset: 0, itens: [item] };
    });
  }

  it("diz o mês do extrato de cada conciliação da página, pela primeira data da rodada que vale", async () => {
    // a do banco anterior falha: ela entra pelo mês em que foi conciliada (24/09)
    backendDoHistorico({ [BANCO_RECENTE]: "2026-08-28" });

    const resultado = await carregarHistorico(1);

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith("/execucoes?limit=50&offset=50");
    expect(chamarBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO_RECENTE}?limit=1&offset=0&extrato_sistema_id=${SISTEMA}`,
    );
    expect(resultado.dados).toMatchObject({ total: 52, porPagina: 50 });
    expect(resultado.dados.execucoes).toHaveLength(2);
    expect(resultado.dados.competencias).toEqual({ [BANCO_RECENTE]: "2026-08", [BANCO_ANTERIOR]: "2026-09" });
  });

  it("devolve o erro da lista, sem perguntar o mês de nada", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Sessão expirada."));
    const resultado = await carregarHistorico();
    expect(resultado).toMatchObject({ ok: false, status: 401 });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });
});

describe("carregarConciliacao", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  /** Cada página com uma linha, e o total pede duas páginas. */
  function backendEmDuasPaginas() {
    chamarBackend.mockImplementation(async (caminho: string) => {
      const offset = new URLSearchParams(caminho.split("?")[1]).get("offset");
      const item = { ...itemConciliacao, id: `c-${offset}` };
      return { extrato_id: BANCO_RECENTE, total: 2, limit: 1000, offset: Number(offset), itens: [item] };
    });
  }

  it("pede só as linhas do par, em todas as páginas", async () => {
    backendEmDuasPaginas();

    const resultado = await carregarConciliacao(BANCO_RECENTE, SISTEMA);

    expect(chamarBackend.mock.calls.map(([caminho]) => caminho)).toEqual([
      `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0&extrato_sistema_id=${SISTEMA}`,
      `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=1000&extrato_sistema_id=${SISTEMA}`,
    ]);
    if (!resultado.ok) throw new Error(resultado.erro);
    // a tela precisa do par para montar os links das linhas
    expect(resultado.dados.conciliacao.extratoSistemaId).toBe(SISTEMA);
  });

  it("sem o extrato do sistema, pede todas as linhas do extrato do banco", async () => {
    backendEmDuasPaginas();

    const resultado = await carregarConciliacao(BANCO_RECENTE);

    expect(chamarBackend).toHaveBeenCalledWith(`/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0`);
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.conciliacao.extratoSistemaId).toBeUndefined();
  });

  it("recusa um extrato do banco que não é UUID, sem chamar o backend", async () => {
    // Server Action é endpoint público: o id entra no caminho da chamada ao
    // backend, e "../execucoes" levaria o token da sessão a outra rota
    const resultado = await carregarConciliacao("../execucoes");

    expect(resultado).toEqual({ ok: false, status: 404, erro: "Conciliação não encontrada." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("recusa um extrato do sistema que não é UUID, sem chamar o backend", async () => {
    // o parâmetro vem da URL: não vai para a query do backend sem conferir
    const resultado = await carregarConciliacao(BANCO_RECENTE, "x&status=duplicado");

    expect(resultado).toEqual({ ok: false, status: 404, erro: "Conciliação não encontrada." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("carregarPainel", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("sem execução nenhuma, não tem o que carregar", async () => {
    backendCom([]);

    expect(await carregarPainel()).toEqual({
      ok: true,
      dados: { recente: null, anteriores: [], rodadas: {} },
    });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });

  it("abre as linhas da execução mais recente e lista as outras atuais", async () => {
    backendCom([
      execucao("e-3", BANCO_RECENTE),
      execucao("e-2", BANCO_ANTERIOR, false),
      execucao("e-1", BANCO_ANTERIOR),
    ]);

    const resultado = await carregarPainel();

    // só as linhas do par da execução: o mesmo extrato do banco pode ter sido
    // conciliado com outro arquivo do sistema
    expect(chamarBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0&extrato_sistema_id=${SISTEMA}`,
    );
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.recente?.id).toBe(BANCO_RECENTE);
    expect(resultado.dados.recente?.extratoSistemaId).toBe(SISTEMA);
    expect(resultado.dados.recente?.linhas.map((linha) => linha.id)).toEqual(["c-1"]);
    // a substituída (e-2) fica só no histórico; no painel, cada par aparece uma vez
    expect(resultado.dados.anteriores.map((item) => item.id)).toEqual(["e-1"]);
  });

  it("diz quantas rodadas cada conciliação tem, para a lista das anteriores", async () => {
    backendCom([
      execucao("e-3", BANCO_RECENTE),
      { ...execucao("e-2", BANCO_ANTERIOR), extrato_sistema_id: "sistema-v2", executada_em: "2026-09-24T10:00:00Z" },
      { ...execucao("e-1", BANCO_ANTERIOR), executada_em: "2026-09-23T10:00:00Z" },
    ]);

    const resultado = await carregarPainel();
    if (!resultado.ok) throw new Error(resultado.erro);
    // o banco anterior está na rodada 2: a 1 (e-1) fica só no histórico
    expect(resultado.dados.anteriores.map((item) => item.id)).toEqual(["e-2"]);
    expect(resultado.dados.rodadas).toEqual({ [BANCO_RECENTE]: 1, [BANCO_ANTERIOR]: 2 });
  });

  it("a versão antiga do extrato do sistema não aparece como outra conciliação", async () => {
    backendComRodadas();

    const resultado = await carregarPainel();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.recente?.extratoSistemaId).toBe(SISTEMA_V2);
    expect(resultado.dados.anteriores).toEqual([]);
  });

  it("devolve a falha quando as linhas da mais recente não carregam", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return { total: 1, limit: 50, offset: 0, itens: [execucao("e-1", BANCO_RECENTE)] };
      }
      throw new ErroBackend(404, "Extrato não encontrado.");
    });

    expect(await carregarPainel()).toEqual({
      ok: false,
      status: 404,
      erro: "Extrato não encontrado.",
    });
  });
});

describe("listarExtratos", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  /**
   * /execucoes com duas rodadas que dividem o extrato do sistema. `datas` é a primeira data de
   * cada conciliação, pelo extrato do banco; sem ela, a conciliação responde erro.
   */
  function backendComExtratos(detalhes: Record<string, unknown>, datas: Record<string, string> = {}) {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return {
          total: 2,
          limit: 50,
          offset: 0,
          itens: [execucao("e-2", BANCO_RECENTE), execucao("e-1", BANCO_ANTERIOR)],
        };
      }
      if (caminho.startsWith("/conciliacoes/")) {
        const banco = caminho.slice("/conciliacoes/".length, caminho.indexOf("?"));
        const data = datas[banco];
        if (!data) throw new ErroBackend(500, "O servidor respondeu 500.");
        const item = { ...itemConciliacao, lancamento_banco: { ...itemConciliacao.lancamento_banco!, data } };
        return { extrato_id: banco, total: 1, limit: 1, offset: 0, itens: [item] };
      }
      const id = caminho.replace("/extratos/", "");
      const detalhe = detalhes[id];
      if (detalhe instanceof Error) throw detalhe;
      if (detalhe) return detalhe;
      throw new Error(`caminho inesperado: ${caminho}`);
    });
  }

  function detalhe(id: string, origem: "banco" | "sistema", erros: { identificador: string; motivo: string }[] = []) {
    return {
      extrato_id: id,
      status: erros.length > 0 ? "concluido_com_erros" : "concluido",
      origem,
      quantidade_lancamentos: 12,
      erros,
    };
  }

  it("junta cada arquivo das execuções com a situação que o backend guarda dele", async () => {
    backendComExtratos(
      {
        [BANCO_RECENTE]: detalhe(BANCO_RECENTE, "banco"),
        [SISTEMA]: detalhe(SISTEMA, "sistema", [{ identificador: "linha 14", motivo: "valor ilegível" }]),
        [BANCO_ANTERIOR]: detalhe(BANCO_ANTERIOR, "banco"),
      },
      { [BANCO_RECENTE]: "2026-09-04", [BANCO_ANTERIOR]: "2026-08-03" },
    );

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    // o extrato do sistema aparece uma vez só, mesmo usado nas duas rodadas
    expect(resultado.dados.map((arquivo) => arquivo.id)).toEqual([BANCO_RECENTE, SISTEMA, BANCO_ANTERIOR]);
    expect(resultado.dados[1]).toEqual({
      id: SISTEMA,
      nome: "e-2-sistema.csv",
      origem: "sistema",
      conciliadoEm: "2026-09-24T17:02:11Z",
      resultado: `/conciliacoes/${BANCO_RECENTE}?sistema=${SISTEMA}`,
      // a única rodada do extrato do banco mais recente
      rodada: { numero: 1, total: 1 },
      situacao: "concluido_com_erros",
      lancamentos: 12,
      erros: [{ identificador: "linha 14", motivo: "valor ilegível" }],
      competencia: "2026-09",
    });
    expect(chamarBackend).toHaveBeenCalledWith(`/extratos/${SISTEMA}`);
  });

  it("diz de que mês é cada arquivo pela primeira data da conciliação em que ele entrou", async () => {
    backendComExtratos(
      {
        [BANCO_RECENTE]: detalhe(BANCO_RECENTE, "banco"),
        [SISTEMA]: detalhe(SISTEMA, "sistema"),
        [BANCO_ANTERIOR]: detalhe(BANCO_ANTERIOR, "banco"),
      },
      // agosto conciliado em setembro: o mês é o do extrato, não o da conciliação
      { [BANCO_RECENTE]: "2026-09-04", [BANCO_ANTERIOR]: "2026-08-03" },
    );

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.map(({ id, competencia }) => [id, competencia])).toEqual([
      [BANCO_RECENTE, "2026-09"],
      [SISTEMA, "2026-09"],
      [BANCO_ANTERIOR, "2026-08"],
    ]);
  });

  it("sem a data da conciliação, usa o mês em que o arquivo foi conciliado", async () => {
    backendComExtratos({
      [BANCO_RECENTE]: detalhe(BANCO_RECENTE, "banco"),
      [SISTEMA]: detalhe(SISTEMA, "sistema"),
      [BANCO_ANTERIOR]: detalhe(BANCO_ANTERIOR, "banco"),
    });

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados[2].competencia).toBe("2026-09");
  });

  it("mantém o arquivo na lista quando o detalhe dele não carrega", async () => {
    backendComExtratos({
      [BANCO_RECENTE]: new ErroBackend(404, "Extrato não encontrado."),
      [SISTEMA]: detalhe(SISTEMA, "sistema"),
      [BANCO_ANTERIOR]: detalhe(BANCO_ANTERIOR, "banco"),
    });

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados[0]).toMatchObject({
      id: BANCO_RECENTE,
      situacao: null,
      lancamentos: null,
      erros: [],
    });
    expect(resultado.dados[1].situacao).toBe("concluido");
  });

  it("devolve a falha quando nem as execuções carregam", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token expirado"));

    expect(await listarExtratos()).toMatchObject({ ok: false, status: 401 });
  });
});

describe("carregarVisaoGeral", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("abre a rodada vigente, mesmo que a versão antiga tenha sido reconciliada depois", async () => {
    // a v1 conciliada de novo em 25/09 é a execução mais recente, mas a rodada que vale é a da v2
    const [v2, v1] = duasRodadas();
    backendComRodadas([{ ...v1, id: "e-v1b", executada_em: "2026-09-25T09:00:00Z" }, v2, { ...v1, atual: false }]);

    const resultado = await carregarVisaoGeral();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.recente?.execucao.extratoSistemaId).toBe(SISTEMA_V2);
  });

  function situacao(id: string, erros: { identificador: string; motivo: string }[] = []) {
    return { extrato_id: id, status: "concluido", origem: "banco", quantidade_lancamentos: 2, erros };
  }

  /** /execucoes, as linhas da mais recente e o detalhe de cada arquivo pedido. */
  function backendComVisao(execucoes: ExecucaoAPI[], extratos: Record<string, unknown>) {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return { total: 7, limit: 50, offset: 0, itens: execucoes };
      }
      if (caminho.startsWith(`/conciliacoes/${BANCO_RECENTE}`)) {
        return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
      }
      const detalhe = extratos[caminho.replace("/extratos/", "")];
      if (detalhe instanceof Error) throw detalhe;
      if (detalhe) return detalhe;
      throw new Error(`caminho inesperado: ${caminho}`);
    });
  }

  it("diz o mês do extrato de cada conciliação só quando a tela pede, e não a cada abertura da barra do topo", async () => {
    backendComVisao(
      // o banco anterior não tem a primeira linha: fica no mês em que rodou
      [execucao("e-3", BANCO_RECENTE), { ...execucao("e-1", BANCO_ANTERIOR), executada_em: "2026-10-02T12:00:00Z" }],
      { [BANCO_RECENTE]: situacao(BANCO_RECENTE), [SISTEMA]: situacao(SISTEMA) },
    );

    const semMes = await carregarVisaoGeral();
    if (!semMes.ok) throw new Error(semMes.erro);
    expect(semMes.dados.competencias).toBeUndefined();
    expect(chamarBackend).not.toHaveBeenCalledWith(expect.stringContaining("?limit=1&offset=0"));

    const comMes = await carregarVisaoGeral({ competencias: true });
    if (!comMes.ok) throw new Error(comMes.erro);
    // a primeira linha do banco recente é de 04/09
    expect(comMes.dados.competencias).toEqual({ [BANCO_RECENTE]: "2026-09", [BANCO_ANTERIOR]: "2026-10" });
  });

  it("sem execução nenhuma, não tem o que abrir", async () => {
    backendCom([]);

    expect(await carregarVisaoGeral()).toEqual({
      ok: true,
      dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
    });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });

  it("abre as linhas da mais recente e a situação só dos dois arquivos dela", async () => {
    backendComVisao(
      [
        execucao("e-3", BANCO_RECENTE),
        execucao("e-2", BANCO_ANTERIOR, false),
        execucao("e-1", BANCO_ANTERIOR),
      ],
      {
        [BANCO_RECENTE]: situacao(BANCO_RECENTE),
        [SISTEMA]: situacao(SISTEMA, [
          { identificador: "linha 14", motivo: "valor ilegível" },
          { identificador: "linha 15", motivo: "data ilegível" },
        ]),
      },
    );

    const resultado = await carregarVisaoGeral();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.total).toBe(7);
    expect(resultado.dados.execucoes.map((item) => item.id)).toEqual(["e-3", "e-2", "e-1"]);
    expect(resultado.dados.recente?.execucao.id).toBe("e-3");
    expect(resultado.dados.recente?.conciliacao.linhas.map((linha) => linha.id)).toEqual(["c-1"]);
    expect(chamarBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0&extrato_sistema_id=${SISTEMA}`,
    );
    expect(resultado.dados.arquivosComLinhasNaoLidas).toEqual([
      { nome: "e-3-sistema.csv", linhas: 2 },
    ]);
    // os arquivos das rodadas antigas não entram: a visão geral fala do mês corrente
    expect(chamarBackend).not.toHaveBeenCalledWith(`/extratos/${BANCO_ANTERIOR}`);
  });

  it("segue sem o aviso do arquivo quando o detalhe dele não carrega", async () => {
    backendComVisao([execucao("e-1", BANCO_RECENTE)], {
      [BANCO_RECENTE]: new ErroBackend(404, "Extrato não encontrado."),
      [SISTEMA]: situacao(SISTEMA),
    });

    const resultado = await carregarVisaoGeral();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.recente?.execucao.id).toBe("e-1");
    expect(resultado.dados.arquivosComLinhasNaoLidas).toEqual([]);
  });

  it("devolve a falha quando as linhas da mais recente não carregam", async () => {
    backendComVisao([execucao("e-1", BANCO_ANTERIOR)], {});

    expect(await carregarVisaoGeral()).toMatchObject({ ok: false });
  });

  it("devolve a falha quando nem as execuções carregam", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token expirado"));

    expect(await carregarVisaoGeral()).toMatchObject({ ok: false, status: 401 });
  });
});

describe("explicarDivergencia", () => {
  const LINHA = "6f55ff77-7794-4079-8186-ba17414abbe6";

  beforeEach(() => {
    chamarBackend.mockReset();
  });

  function resposta(parcial: Record<string, unknown> = {}) {
    return {
      conciliacao_id: LINHA,
      status: "divergente_valor",
      explicacao: "Há lançamentos do outro lado na mesma data, mas nenhum com este valor.",
      gerada_por_ia: true,
      em_cache: false,
      indisponibilidade: null,
      ...parcial,
    };
  }

  it("pede a explicação da linha, com prazo para a IA responder", async () => {
    chamarBackend.mockResolvedValue(resposta());

    const resultado = await explicarDivergencia(LINHA);

    const [caminho, init] = chamarBackend.mock.calls[0] as [string, RequestInit & { corpo: unknown }];
    expect(caminho).toBe("/explicacoes");
    expect(init.method).toBe("POST");
    expect(init.corpo).toEqual({ conciliacao_id: LINHA });
    // o backend espera até 20 s pelo provedor; sem prazo do nosso lado, uma
    // resposta que nunca chega prenderia a tela no "Explicando…"
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(resultado).toEqual({
      ok: true,
      dados: {
        texto: "Há lançamentos do outro lado na mesma data, mas nenhum com este valor.",
        geradaPorIa: true,
        indisponibilidade: null,
      },
    });
  });

  it("diz por que o texto é o fixo do motor quando a IA não respondeu", async () => {
    chamarBackend.mockResolvedValue(resposta({ gerada_por_ia: false, indisponibilidade: "limite_diario" }));

    expect(await explicarDivergencia(LINHA)).toMatchObject({
      ok: true,
      dados: { geradaPorIa: false, indisponibilidade: "limite_diario" },
    });
  });

  it("avisa que a linha mudou quando a conciliação foi refeita", async () => {
    // o id da linha muda quando o par é conciliado de novo
    chamarBackend.mockRejectedValue(new ErroBackend(404, "Conciliação não encontrada."));

    expect(await explicarDivergencia(LINHA)).toEqual({
      ok: false,
      status: 404,
      erro: "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.",
    });
  });

  it("não deixa a tela esperando para sempre", async () => {
    chamarBackend.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    expect(await explicarDivergencia(LINHA)).toEqual({
      ok: false,
      status: 504,
      erro: "A explicação demorou mais que o normal. Tente de novo em instantes.",
    });
  });

  it("traduz a sessão vencida para a mensagem da tela", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token expirado"));

    expect(await explicarDivergencia(LINHA)).toMatchObject({ ok: false, status: 401 });
  });
});

describe("registrarDecisao", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("grava na rota de decisões do extrato do banco e devolve a decisão em vigor", async () => {
    const emVigor = {
      tipo: "justificada",
      texto: "Juros de dois dias de atraso.",
      autor: "Eduardo Sichelero",
      em: "2026-09-30T10:12:00-03:00",
      rodada: 2,
    };
    chamarBackend.mockResolvedValue(emVigor);

    const resultado = await registrarDecisao(BANCO_RECENTE, "lb-1", "justificada", "Juros de dois dias de atraso.");

    expect(chamarBackend).toHaveBeenCalledWith(`/conciliacoes/${BANCO_RECENTE}/decisoes`, {
      method: "POST",
      corpo: { chave: "lb-1", tipo: "justificada", texto: "Juros de dois dias de atraso." },
    });
    expect(resultado).toEqual({ ok: true, dados: emVigor });
  });

  it("desfazer deixa a linha sem decisão", async () => {
    chamarBackend.mockResolvedValue(null);

    expect(await registrarDecisao(BANCO_RECENTE, "lb-1", "conferencia_desfeita")).toEqual({ ok: true, dados: null });
  });

  it("avisa que a linha mudou quando outra rodada entrou no meio", async () => {
    // a chave que a tela tem não existe mais na conciliação de agora
    chamarBackend.mockRejectedValue(new ErroBackend(404, "Linha não encontrada."));

    expect(await registrarDecisao(BANCO_RECENTE, "lb-1", "conferida")).toEqual({
      ok: false,
      status: 404,
      erro: "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.",
    });
  });

  it("recusa um id que não é UUID, sem chamar o backend", async () => {
    expect(await registrarDecisao("../extratos", "lb-1", "conferida")).toEqual({
      ok: false,
      status: 404,
      erro: "Conciliação não encontrada.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("situacaoDoExtrato", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("pergunta ao backend pelo extrato", async () => {
    chamarBackend.mockResolvedValue({
      extrato_id: SISTEMA,
      status: "concluido",
      origem: "sistema",
      quantidade_lancamentos: 12,
      erros: [],
    });

    expect(await situacaoDoExtrato(SISTEMA)).toMatchObject({ ok: true, dados: { status: "concluido" } });
    expect(chamarBackend).toHaveBeenCalledWith(`/extratos/${SISTEMA}`);
  });

  it("recusa um id que não é UUID, sem chamar o backend", async () => {
    const resultado = await situacaoDoExtrato("upload?x=1");

    expect(resultado).toEqual({ ok: false, status: 404, erro: "Extrato não encontrado." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("carregarFechamentos", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  function situacao(id: string, erros: { identificador: string; motivo: string }[] = []) {
    return { extrato_id: id, status: "concluido", origem: "banco", quantidade_lancamentos: 2, erros };
  }

  it("dá a cada par atual o mês do extrato e as linhas não lidas dos dois arquivos", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return {
          total: 2,
          limit: 50,
          offset: 0,
          itens: [execucao("e-2", BANCO_RECENTE), execucao("e-1", BANCO_ANTERIOR, false)],
        };
      }
      if (caminho.startsWith(`/conciliacoes/${BANCO_RECENTE}`)) {
        return { extrato_id: BANCO_RECENTE, total: 140, limit: 1, offset: 0, itens: [itemConciliacao] };
      }
      if (caminho === `/extratos/${BANCO_RECENTE}`) return situacao(BANCO_RECENTE);
      if (caminho === `/extratos/${SISTEMA}`) {
        return situacao(SISTEMA, [{ identificador: "linha 14", motivo: "valor ilegível" }]);
      }
      throw new Error(`caminho inesperado: ${caminho}`);
    });

    const resultado = await carregarFechamentos();

    // a rodada substituída (e-1, atual: false) não entra
    expect(resultado).toMatchObject({
      ok: true,
      dados: [
        {
          execucao: { id: "e-2" },
          primeiraData: "2026-09-04",
          naoLidas: [{ nome: "e-2-sistema.csv", linhas: 1 }],
        },
      ],
    });
    // só a primeira linha, pela data: a lista vem em ordem de data
    expect(chamarBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO_RECENTE}?limit=1&offset=0&extrato_sistema_id=${SISTEMA}`,
    );
  });

  it("conta um par por extrato do banco: a versão nova do sistema substitui a antiga", async () => {
    backendComRodadas();

    const resultado = await carregarFechamentos();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.map((par) => par.execucao.extratoSistemaId)).toEqual([SISTEMA_V2]);
  });

  it("mantém o par sem a data quando a primeira linha não vem", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return { total: 1, limit: 50, offset: 0, itens: [execucao("e-1", BANCO_RECENTE)] };
      }
      if (caminho.startsWith("/conciliacoes/")) throw new ErroBackend(500, "Erro interno.");
      return situacao(caminho.replace("/extratos/", ""));
    });

    expect(await carregarFechamentos()).toMatchObject({
      ok: true,
      dados: [{ execucao: { id: "e-1" }, primeiraData: null, naoLidas: [] }],
    });
  });

  it("devolve a falha quando nem a lista de execuções vem", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token inválido."));

    expect(await carregarFechamentos()).toMatchObject({ ok: false, status: 401 });
  });
});

describe("carregarConciliacaoEmRodadas", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  const caminhoDasLinhas = (sistema?: string) =>
    `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0${sistema ? `&extrato_sistema_id=${sistema}` : ""}`;

  it("sem o sistema na URL, abre a rodada mais recente", async () => {
    backendComRodadas();

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith(caminhoDasLinhas(SISTEMA_V2));
    expect(resultado.dados.rodada).toEqual({
      numero: 2,
      total: 2,
      extratoSistemaId: SISTEMA_V2,
      arquivoSistema: "e-v2-sistema.csv",
      executadaEm: "2026-09-24T17:02:11Z",
    });
    expect(resultado.dados.conciliacao.extratoSistemaId).toBe(SISTEMA_V2);
    // a rodada vai junto da conciliação: é por ela que uma conferência antiga perde o valor
    expect(resultado.dados.conciliacao.rodada).toBe(2);
  });

  it("traz todas as rodadas do extrato, da primeira à mais recente, para a linha das rodadas", async () => {
    backendComRodadas();

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE, SISTEMA_V1);
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.rodadas).toEqual([
      {
        numero: 1,
        total: 2,
        extratoSistemaId: SISTEMA_V1,
        arquivoSistema: "e-v1-sistema.csv",
        executadaEm: "2026-09-23T12:00:00Z",
      },
      {
        numero: 2,
        total: 2,
        extratoSistemaId: SISTEMA_V2,
        arquivoSistema: "e-v2-sistema.csv",
        executadaEm: "2026-09-24T17:02:11Z",
      },
    ]);
  });

  it("com o sistema de uma rodada antiga, abre aquela, sem comparação", async () => {
    backendComRodadas();

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE, SISTEMA_V1);
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith(caminhoDasLinhas(SISTEMA_V1));
    expect(resultado.dados.rodada?.numero).toBe(1);
    expect(resultado.dados.mudancas).toBeNull();
  });

  it("compara com a rodada anterior", async () => {
    const execucoes = duasRodadas();
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) return { total: 2, limit: 50, offset: 0, itens: execucoes };
      // na v1 a transferência não tinha par; a v2 do sistema trouxe o lançamento
      const bateu = caminho.endsWith(SISTEMA_V2);
      const itens = [bateu ? { ...itemConciliacao, status: "match_exato" } : itemConciliacao];
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens };
    });

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.mudancas).toEqual({ passaramABater: 1, continuamDivergindo: 0, novas: 0 });
  });

  it("sem execução do extrato, abre como antes, sem rodada", async () => {
    // o extrato é mais antigo que as páginas de /execucoes que a tela lê
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return { total: 1, limit: 50, offset: 0, itens: [execucao("e-outro", BANCO_ANTERIOR)] };
      }
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
    });

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);
    expect(resultado).toMatchObject({ ok: true, dados: { rodada: null, rodadas: [], mudancas: null } });
    expect(chamarBackend).toHaveBeenCalledWith(caminhoDasLinhas());
  });

  it("recusa um id que não é de extrato sem chamar o backend", async () => {
    expect(await carregarConciliacaoEmRodadas("../etc")).toMatchObject({ ok: false, status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

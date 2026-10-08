import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecucaoAPI, ItemConciliacaoAPI } from "@/lib/adaptadores";
import { ErroBackend } from "@/lib/backend";
import {
  carregarConciliacao,
  carregarConciliacaoEmRodadas,
  carregarFechamentos,
  carregarConciliacoes,
  carregarVisaoGeral,
  conciliar,
  enviarExtrato,
  explicarDivergencia,
  fecharMes,
  listarExecucoes,
  listarExtratos,
  reabrirMes,
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
    // o período é sempre o do extrato do banco (backend #82)
    periodo_inicio: "2026-09-01",
    periodo_fim: "2026-09-30",
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

/** Um fechamento como `/fechamentos` devolve (backend #86). */
function fechamento(competencia: string, parcial: Record<string, unknown> = {}) {
  return {
    id: `f-${competencia}`,
    competencia,
    estado: "fechado",
    ressalva: null,
    fechado_por: "Maria Financeiro",
    fechado_em: "2026-10-06T15:20:00.123456Z",
    reaberto_por: null,
    reaberto_em: null,
    resumo: {
      pares: [],
      contagens: {},
      justificadas: 0,
      pendentes: 0,
      linhas_nao_lidas: 0,
      valor_em_aberto: "0.00",
    },
    ...parcial,
  };
}

/** O backend com as duas rodadas: linhas, situação dos arquivos, execuções e fechamentos (nenhum). */
function backendComRodadas(execucoes: ExecucaoAPI[] = duasRodadas(), fechamentos: unknown[] = []) {
  chamarBackend.mockImplementation(async (caminho: string) => {
    if (caminho.startsWith("/fechamentos")) {
      const competencia = new URLSearchParams(caminho.split("?")[1]).get("competencia");
      return { itens: fechamentos.filter((item) => !competencia || (item as { competencia: string }).competencia === competencia) };
    }
    if (caminho.startsWith("/execucoes")) {
      // com `?extrato_banco_id=`, só as daquele extrato, e o total conta só elas
      const banco = new URLSearchParams(caminho.split("?")[1]).get("extrato_banco_id");
      const itens = banco ? execucoes.filter((item) => item.extrato_banco_id === banco) : execucoes;
      return { total: itens.length, limit: 50, offset: 0, itens };
    }
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

describe("carregarConciliacoes", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("sem execução nenhuma, não tem o que listar", async () => {
    backendCom([]);
    expect(await carregarConciliacoes()).toEqual({
      ok: true,
      dados: { conciliacoes: [], emAndamento: null, parcial: false },
    });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });

  it("lista cada extrato do banco uma vez, na rodada que vale, com o mês do extrato", async () => {
    // o banco recente em duas rodadas; o anterior, de agosto, com uma refeita, que não conta
    const deAgosto = { periodo_inicio: "2026-08-01", periodo_fim: "2026-08-31" };
    backendComRodadas([
      ...duasRodadas(),
      { ...execucao("e-a2", BANCO_ANTERIOR), ...deAgosto, executada_em: "2026-09-02T12:00:00Z" },
      { ...execucao("e-a1", BANCO_ANTERIOR, false), ...deAgosto, executada_em: "2026-09-01T12:00:00Z" },
    ]);

    const resultado = await carregarConciliacoes();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(
      resultado.dados.conciliacoes.map((item) => [item.extratoBancoId, item.execucao.id, item.rodada, item.rodadas, item.competencia]),
    ).toEqual([
      // o mês é o do período do extrato do banco, não o de quando rodou
      [BANCO_RECENTE, "e-v2", 2, 2, "2026-09"],
      [BANCO_ANTERIOR, "e-a2", 1, 1, "2026-08"],
    ]);
    // o mês vem de /execucoes: nenhuma conciliação é aberta só para saber a primeira data
    expect(chamarBackend).not.toHaveBeenCalledWith(expect.stringContaining("?limit=1&"));
    // as quatro execuções vieram numa página só
    expect(resultado.dados.parcial).toBe(false);
  });

  it("abre as linhas da que está em andamento, para contar o que já foi decidido", async () => {
    // a única linha do backend: sem par no sistema, ainda sem decisão
    backendComRodadas(duasRodadas());

    const resultado = await carregarConciliacoes();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0&extrato_sistema_id=${SISTEMA_V2}`,
    );
    expect(resultado.dados.emAndamento).toEqual({
      extratoBancoId: BANCO_RECENTE,
      batem: 0,
      pedemDecisao: 1,
      justificadas: 0,
      // o backend não manda `decisao`: não há conferência para contar
      conferidas: null,
    });
  });

  it("não tem nada em andamento quando nada pede decisão", async () => {
    backendCom([{ ...execucao("e-1", BANCO_RECENTE), contagens: { ...execucao("e-1", BANCO_RECENTE).contagens, match_exato: 2, sem_correspondencia: 0 } }]);

    const resultado = await carregarConciliacoes();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.emAndamento).toBeNull();
    expect(resultado.dados.conciliacoes).toHaveLength(1);
  });

  it("devolve a falha da lista", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Sessão expirada."));
    expect(await carregarConciliacoes()).toMatchObject({ ok: false, status: 401 });
  });
});

describe("listarExtratos", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  const NAO_CONCILIADO = "5c5c5c5c-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

  /** Um item de `GET /extratos` (backend #70). */
  function extrato(id: string, parcial: Record<string, unknown> = {}) {
    return {
      extrato_id: id,
      nome_arquivo: `${id}.csv`,
      origem: "sistema",
      formato: "csv",
      status: "concluido",
      quantidade_lancamentos: 12,
      linhas_nao_lidas: 0,
      periodo_inicio: "2026-09-01",
      periodo_fim: "2026-09-30",
      enviado_em: "2026-09-24T17:00:00Z",
      conciliado: true,
      ...parcial,
    };
  }

  /**
   * `GET /extratos` com `extratos` (paginado de 100 em 100), `/execucoes` com a rodada do banco
   * recente e o detalhe de cada extrato em `detalhes`.
   */
  function backendComExtratos(extratos: unknown[], detalhes: Record<string, unknown> = {}) {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/extratos?")) {
        const offset = Number(new URLSearchParams(caminho.split("?")[1]).get("offset"));
        return { total: extratos.length, limit: 100, offset, itens: extratos.slice(offset, offset + 100) };
      }
      if (caminho.startsWith("/execucoes")) {
        return { total: 1, limit: 50, offset: 0, itens: [execucao("e-2", BANCO_RECENTE)] };
      }
      const detalhe = detalhes[caminho.replace("/extratos/", "")];
      if (detalhe instanceof Error) throw detalhe;
      if (detalhe) return detalhe;
      throw new Error(`caminho inesperado: ${caminho}`);
    });
  }

  it("lista todos os extratos enviados, inclusive os que ainda não entraram em conciliação", async () => {
    backendComExtratos([
      extrato(NAO_CONCILIADO, { nome_arquivo: "erp-outubro.csv", conciliado: false, periodo_inicio: "2026-10-01" }),
      extrato(SISTEMA, { nome_arquivo: "erp-setembro.csv" }),
    ]);

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith("/extratos?limit=100&offset=0");
    expect(resultado.dados.total).toBe(2);
    expect(resultado.dados.arquivos[0]).toEqual({
      id: NAO_CONCILIADO,
      nome: "erp-outubro.csv",
      origem: "sistema",
      situacao: "concluido",
      lancamentos: 12,
      naoLidas: 0,
      erros: [],
      competencia: "2026-10",
      enviadoEm: "2026-09-24T17:00:00Z",
      conciliado: false,
    });
  });

  it("liga cada arquivo conciliado à conciliação em que ele abre", async () => {
    // o banco anterior não está na página de /execucoes, mas o extrato do banco abre pelo próprio id
    backendComExtratos([
      extrato(SISTEMA, { nome_arquivo: "erp-setembro.csv" }),
      extrato(BANCO_RECENTE, { origem: "banco", nome_arquivo: "sicredi-setembro.ofx" }),
      extrato(BANCO_ANTERIOR, { origem: "banco", nome_arquivo: "sicredi-agosto.ofx" }),
    ]);

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    const [sistema, banco, anterior] = resultado.dados.arquivos;
    expect(sistema).toMatchObject({
      resultado: `/conciliacoes/${BANCO_RECENTE}?sistema=${SISTEMA}`,
      conciliadoEm: "2026-09-24T17:02:11Z",
      rodada: { numero: 1, total: 1 },
    });
    expect(banco).toMatchObject({ resultado: `/conciliacoes/${BANCO_RECENTE}`, conciliadoEm: "2026-09-24T17:02:11Z" });
    expect(anterior.resultado).toBe(`/conciliacoes/${BANCO_ANTERIOR}`);
    expect(anterior.conciliadoEm).toBeUndefined();
  });

  it("pede o detalhe só dos arquivos com linha não lida, para mostrar o motivo de cada uma", async () => {
    const erros = [{ identificador: "linha 14", motivo: "valor ilegível" }];
    backendComExtratos(
      [
        extrato(SISTEMA, { status: "concluido_com_erros", linhas_nao_lidas: 1 }),
        extrato(BANCO_RECENTE, { origem: "banco" }),
      ],
      { [SISTEMA]: { extrato_id: SISTEMA, status: "concluido_com_erros", origem: "sistema", quantidade_lancamentos: 12, erros } },
    );

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.arquivos[0]).toMatchObject({ naoLidas: 1, erros });
    expect(chamarBackend).toHaveBeenCalledWith(`/extratos/${SISTEMA}`);
    expect(chamarBackend).not.toHaveBeenCalledWith(`/extratos/${BANCO_RECENTE}`);
  });

  it("mantém a contagem das linhas não lidas quando o detalhe delas não carrega", async () => {
    backendComExtratos([extrato(SISTEMA, { status: "concluido_com_erros", linhas_nao_lidas: 3 })], {
      [SISTEMA]: new ErroBackend(500, "O servidor respondeu 500."),
    });

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.arquivos[0]).toMatchObject({ naoLidas: 3, erros: [] });
  });

  it("põe o extrato do sistema no mês da conciliação em que entrou, que é o do extrato do banco", async () => {
    // o sistema tem uma linha de 29/08 que o banco não tem: o período dele começa em agosto, mas a
    // conciliação (e o fechamento) é de setembro, o mês do extrato do banco
    backendComExtratos([
      extrato(SISTEMA, { periodo_inicio: "2026-08-29" }),
      extrato(NAO_CONCILIADO, { periodo_inicio: "2026-08-29", conciliado: false }),
    ]);

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.arquivos.map(({ competencia }) => competencia)).toEqual(["2026-09", "2026-08"]);
  });

  it("deixa sem mês o extrato que ainda não tem período", async () => {
    backendComExtratos([
      extrato(NAO_CONCILIADO, {
        status: "processando",
        quantidade_lancamentos: null,
        periodo_inicio: null,
        periodo_fim: null,
        conciliado: false,
      }),
    ]);

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.arquivos[0]).toMatchObject({ competencia: null, situacao: "processando", lancamentos: null });
  });

  it("vira a página até trazer todos", async () => {
    const muitos = Array.from({ length: 150 }, (_, i) =>
      extrato(`${String(i).padStart(8, "0")}-1e3f-4a5b-8c6d-9e0f1a2b3c4d`, { conciliado: false }),
    );
    backendComExtratos(muitos);

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith("/extratos?limit=100&offset=100");
    expect(resultado.dados.arquivos).toHaveLength(150);
  });

  it("segue sem a conciliação do extrato do sistema quando as execuções não carregam", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/extratos?")) {
        return { total: 1, limit: 100, offset: 0, itens: [extrato(SISTEMA)] };
      }
      throw new ErroBackend(500, "O servidor respondeu 500.");
    });

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.arquivos[0]).toMatchObject({ id: SISTEMA, conciliado: true });
    expect(resultado.dados.arquivos[0].resultado).toBeUndefined();
  });

  it("devolve a falha quando a lista de extratos não vem", async () => {
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

  // o prazo do lib/backend estourou: o servidor está lá, só não respondeu a tempo
  it("diz que o servidor demorou quando o prazo estoura", async () => {
    chamarBackend.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));

    expect(await situacaoDoExtrato(SISTEMA)).toEqual({
      ok: false,
      status: 504,
      erro: "O servidor demorou para responder. Tente de novo em instantes.",
    });
  });
});

// o upload sobe o arquivo inteiro e a conciliação roda o motor: os dois passam dos 30 s do padrão
describe("prazo do upload e da conciliação", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
    chamarBackend.mockResolvedValue({ extrato_id: SISTEMA, status: "processando" });
  });

  it("o upload vai com prazo próprio", async () => {
    await enviarExtrato(new FormData());

    const [, opcoes] = chamarBackend.mock.calls[0] as [string, { signal?: AbortSignal }];
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it("a conciliação vai com prazo próprio", async () => {
    await conciliar(BANCO_RECENTE, SISTEMA);

    const [, opcoes] = chamarBackend.mock.calls[0] as [string, { signal?: AbortSignal }];
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("carregarFechamentos", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  function situacao(id: string, erros: { identificador: string; motivo: string }[] = []) {
    return { extrato_id: id, status: "concluido", origem: "banco", quantidade_lancamentos: 2, erros };
  }

  it("dá a cada par atual as linhas não lidas dos dois arquivos, sem abrir a conciliação", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho === "/fechamentos") return { itens: [] };
      if (caminho.startsWith("/execucoes")) {
        return {
          total: 2,
          limit: 50,
          offset: 0,
          itens: [execucao("e-2", BANCO_RECENTE), execucao("e-1", BANCO_ANTERIOR, false)],
        };
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
      dados: {
        pares: [
          {
            // o mês do par é o do período do extrato do banco, que vem na execução
            execucao: { id: "e-2", periodoInicio: "2026-09-01" },
            naoLidas: [{ nome: "e-2-sistema.csv", linhas: 1 }],
          },
        ],
        fechamentos: [],
      },
    });
  });

  it("traz os fechamentos da empresa, os ativos e os reabertos, como o backend os ordena", async () => {
    backendComRodadas(duasRodadas(), [
      fechamento("2026-09", { ressalva: "Tarifa em análise com o banco." }),
      fechamento("2026-08", {
        id: "f-ago-2",
        estado: "reaberto",
        reaberto_por: "Ana",
        reaberto_em: "2026-10-07T10:00:00Z",
      }),
    ]);

    const resultado = await carregarFechamentos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith("/fechamentos");
    expect(resultado.dados.fechamentos).toEqual([
      {
        competencia: "2026-09",
        estado: "fechado",
        ressalva: "Tarifa em análise com o banco.",
        fechadoPor: "Maria Financeiro",
        fechadoEm: "2026-10-06T15:20:00.123456Z",
        reabertoPor: null,
        reabertoEm: null,
      },
      {
        competencia: "2026-08",
        estado: "reaberto",
        ressalva: null,
        fechadoPor: "Maria Financeiro",
        fechadoEm: "2026-10-06T15:20:00.123456Z",
        reabertoPor: "Ana",
        reabertoEm: "2026-10-07T10:00:00Z",
      },
    ]);
  });

  it("segue sem saber dos fechamentos quando a rota deles falha", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho === "/fechamentos") throw new ErroBackend(404, "Not Found");
      if (caminho.startsWith("/execucoes")) return { total: 1, limit: 50, offset: 0, itens: [execucao("e-1", BANCO_RECENTE)] };
      return situacao(caminho.replace("/extratos/", ""));
    });

    const resultado = await carregarFechamentos();

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.pares).toHaveLength(1);
    expect(resultado.dados.fechamentos).toBeNull();
  });

  it("conta um par por extrato do banco: a versão nova do sistema substitui a antiga", async () => {
    backendComRodadas();

    const resultado = await carregarFechamentos();
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.pares.map((par) => par.execucao.extratoSistemaId)).toEqual([SISTEMA_V2]);
  });

  it("devolve a falha quando nem a lista de execuções vem", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token inválido."));

    expect(await carregarFechamentos()).toMatchObject({ ok: false, status: 401 });
  });
});

describe("fecharMes", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("fecha a competência e devolve o fechamento", async () => {
    chamarBackend.mockResolvedValue(fechamento("2026-09"));

    const resultado = await fecharMes("2026-09");

    expect(chamarBackend).toHaveBeenCalledWith("/fechamentos", { method: "POST", corpo: { competencia: "2026-09" } });
    expect(resultado).toMatchObject({ ok: true, dados: { competencia: "2026-09", estado: "fechado", fechadoPor: "Maria Financeiro" } });
  });

  it("manda a ressalva, sem os espaços das pontas, quando há uma", async () => {
    chamarBackend.mockResolvedValue(fechamento("2026-09", { ressalva: "Tarifa em análise." }));

    await fecharMes("2026-09", "  Tarifa em análise.  ");

    expect(chamarBackend).toHaveBeenCalledWith("/fechamentos", {
      method: "POST",
      corpo: { competencia: "2026-09", ressalva: "Tarifa em análise." },
    });
  });

  it("devolve o que falta, no texto do backend, quando há pendência sem ressalva", async () => {
    const falta =
      "Há 2 divergências sem justificativa nesta competência. Justifique, corrija ou feche com ressalva.";
    chamarBackend.mockRejectedValue(new ErroBackend(409, falta));

    expect(await fecharMes("2026-09")).toEqual({ ok: false, status: 409, erro: falta });
  });

  it("recusa uma competência fora do formato sem chamar o backend", async () => {
    expect(await fecharMes("2026-13")).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("reabrirMes", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("reabre a competência pelo DELETE, e o fechamento volta como reaberto", async () => {
    chamarBackend.mockResolvedValue(fechamento("2026-09", { estado: "reaberto", reaberto_por: "Ana" }));

    const resultado = await reabrirMes("2026-09");

    expect(chamarBackend).toHaveBeenCalledWith("/fechamentos/2026-09", { method: "DELETE" });
    expect(resultado).toMatchObject({ ok: true, dados: { estado: "reaberto", reabertoPor: "Ana" } });
  });

  it("recusa uma competência que não é AAAA-MM sem chamar o backend, porque ela vai no caminho", async () => {
    expect(await reabrirMes("../extratos")).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("carregarConciliacaoEmRodadas", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  const caminhoDasLinhas = (sistema?: string) =>
    `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0${sistema ? `&extrato_sistema_id=${sistema}` : ""}`;

  it("pede as rodadas só deste extrato do banco, numa chamada", async () => {
    // outro extrato do banco no meio: o filtro do backend o deixa de fora
    backendComRodadas([...duasRodadas(), execucao("e-outro", BANCO_ANTERIOR)]);

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);
    if (!resultado.ok) throw new Error(resultado.erro);
    const pedidas = chamarBackend.mock.calls
      .map(([caminho]) => caminho as string)
      .filter((caminho) => caminho.startsWith("/execucoes"));
    expect(pedidas).toEqual([`/execucoes?extrato_banco_id=${BANCO_RECENTE}&limit=100&offset=0`]);
    expect(resultado.dados.rodadas.map((rodada) => rodada.extratoSistemaId)).toEqual([SISTEMA_V1, SISTEMA_V2]);
  });

  it("vira a página quando o extrato tem mais rodadas que cabem numa", async () => {
    const [v2, v1] = duasRodadas();
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        const offset = Number(new URLSearchParams(caminho.split("?")[1]).get("offset"));
        return { total: 101, limit: 100, offset, itens: offset === 0 ? [v2] : [v1] };
      }
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
    });

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith(`/execucoes?extrato_banco_id=${BANCO_RECENTE}&limit=100&offset=100`);
    expect(resultado.dados.rodadas).toHaveLength(2);
  });

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
      // o mês da conciliação, o mesmo de Fechamentos
      periodoInicio: "2026-09-01",
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
        periodoInicio: "2026-09-01",
      },
      {
        numero: 2,
        total: 2,
        extratoSistemaId: SISTEMA_V2,
        arquivoSistema: "e-v2-sistema.csv",
        executadaEm: "2026-09-24T17:02:11Z",
        periodoInicio: "2026-09-01",
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
    // o backend não tem execução deste extrato do banco
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return { total: 0, limit: 100, offset: 0, itens: [] };
      }
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
    });

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);
    expect(resultado).toMatchObject({ ok: true, dados: { rodada: null, rodadas: [], mudancas: null } });
    expect(chamarBackend).toHaveBeenCalledWith(caminhoDasLinhas());
  });

  it("diz se o mês da conciliação, o do extrato do banco, está fechado", async () => {
    backendComRodadas(duasRodadas(), [fechamento("2026-09")]);

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(chamarBackend).toHaveBeenCalledWith("/fechamentos?competencia=2026-09");
    expect(resultado.dados.fechamento).toMatchObject({ competencia: "2026-09", estado: "fechado" });
  });

  it("não trava o mês que foi reaberto depois de fechado", async () => {
    // do fechamento mais recente para o mais antigo, como o backend
    backendComRodadas(duasRodadas(), [
      fechamento("2026-09", { id: "f-2", estado: "reaberto", reaberto_por: "Ana", reaberto_em: "2026-10-07T10:00:00Z" }),
    ]);

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.fechamento).toBeNull();
  });

  it("abre a conciliação mesmo quando não dá para saber do fechamento", async () => {
    const execucoes = duasRodadas();
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/fechamentos")) throw new ErroBackend(500, "O servidor respondeu 500.");
      if (caminho.startsWith("/execucoes")) return { total: 2, limit: 100, offset: 0, itens: execucoes };
      return { extrato_id: BANCO_RECENTE, total: 1, limit: 1000, offset: 0, itens: [itemConciliacao] };
    });

    const resultado = await carregarConciliacaoEmRodadas(BANCO_RECENTE);

    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.fechamento).toBeNull();
  });

  it("recusa um id que não é de extrato sem chamar o backend", async () => {
    expect(await carregarConciliacaoEmRodadas("../etc")).toMatchObject({ ok: false, status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

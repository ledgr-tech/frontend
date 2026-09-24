import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecucaoAPI, ItemConciliacaoAPI } from "@/lib/adaptadores";
import { ErroBackend } from "@/lib/backend";
import { carregarPainel, carregarVisaoGeral, listarExecucoes, listarExtratos } from "./acoes";

// A rede é a fronteira: o que se testa é o caminho pedido e o que as actions
// fazem com a resposta. ErroBackend e a tradução de erro rodam de verdade.
const chamarBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
}));

const BANCO_RECENTE = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const BANCO_ANTERIOR = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function execucao(id: string, extratoBancoId: string, atual = true): ExecucaoAPI {
  return {
    id,
    extrato_banco_id: extratoBancoId,
    extrato_sistema_id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
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

  it("traduz a sessão vencida para a mensagem da tela", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Token expirado"));

    expect(await listarExecucoes()).toEqual({
      ok: false,
      status: 401,
      erro: "Sua sessão expirou. Entre de novo para continuar.",
    });
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
      dados: { recente: null, anteriores: [] },
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

    expect(chamarBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO_RECENTE}?limit=1000&offset=0`,
    );
    if (!resultado.ok) throw new Error(resultado.erro);
    expect(resultado.dados.recente?.id).toBe(BANCO_RECENTE);
    expect(resultado.dados.recente?.linhas.map((linha) => linha.id)).toEqual(["c-1"]);
    // a substituída (e-2) fica só no histórico; no painel, cada par aparece uma vez
    expect(resultado.dados.anteriores.map((item) => item.id)).toEqual(["e-1"]);
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
  const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

  beforeEach(() => {
    chamarBackend.mockReset();
  });

  /** /execucoes com duas rodadas que dividem o extrato do sistema. */
  function backendComExtratos(detalhes: Record<string, unknown>) {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho.startsWith("/execucoes")) {
        return {
          total: 2,
          limit: 50,
          offset: 0,
          itens: [execucao("e-2", BANCO_RECENTE), execucao("e-1", BANCO_ANTERIOR)],
        };
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
    backendComExtratos({
      [BANCO_RECENTE]: detalhe(BANCO_RECENTE, "banco"),
      [SISTEMA]: detalhe(SISTEMA, "sistema", [{ identificador: "linha 14", motivo: "valor ilegível" }]),
      [BANCO_ANTERIOR]: detalhe(BANCO_ANTERIOR, "banco"),
    });

    const resultado = await listarExtratos();

    if (!resultado.ok) throw new Error(resultado.erro);
    // o extrato do sistema aparece uma vez só, mesmo usado nas duas rodadas
    expect(resultado.dados.map((arquivo) => arquivo.id)).toEqual([BANCO_RECENTE, SISTEMA, BANCO_ANTERIOR]);
    expect(resultado.dados[1]).toEqual({
      id: SISTEMA,
      nome: "e-2-sistema.csv",
      origem: "sistema",
      conciliadoEm: "2026-09-24T17:02:11Z",
      resultado: `/conciliacoes/${BANCO_RECENTE}`,
      situacao: "concluido_com_erros",
      lancamentos: 12,
      erros: [{ identificador: "linha 14", motivo: "valor ilegível" }],
    });
    expect(chamarBackend).toHaveBeenCalledWith(`/extratos/${SISTEMA}`);
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
  const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

  beforeEach(() => {
    chamarBackend.mockReset();
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

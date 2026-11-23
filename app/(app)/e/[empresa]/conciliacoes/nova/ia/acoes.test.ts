import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import {
  acrescentarLinhaAoRascunho,
  carregarPromptIa,
  carregarRascunho,
  concluirNovaVersaoIa,
  corrigirLinhaDoRascunho,
  importarDoSistema,
  importarViaIa,
  recuperarExtratoConfirmado,
} from "./acoes";

const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));

function dadosDoArquivo(tamanho: number): FormData {
  const arquivo = new File(["{}"], "resposta.json", { type: "application/json" });
  Object.defineProperty(arquivo, "size", { value: tamanho });
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  return dados;
}

describe("carregarPromptIa", () => {
  it("põe no fim do prompt do backend o pedido do arquivo lancamentos.json", async () => {
    chamarBackend.mockReset();
    chamarBackend.mockResolvedValue({ versao_schema: "1", versao_prompt: "1", prompt: "Responda somente com o JSON.\n" });

    const resultado = await carregarPromptIa();

    expect(resultado).toMatchObject({ ok: true, dados: { versaoSchema: "1", versaoPrompt: "1" } });
    const prompt = resultado.ok ? resultado.dados.prompt : "";
    expect(prompt.startsWith("Responda somente com o JSON.\n\nEntrega: crie um arquivo para baixar, chamado lancamentos.json")).toBe(true);
    expect(prompt).toContain("não escreva o JSON na conversa");
  });
});

describe("importarViaIa: limite do envio", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
    chamarBackend.mockResolvedValue({ importacao_id: "rascunho", quantidade_lancamentos: 2 });
  });

  it("recusa acima de 4 MB mesmo quando o navegador não validou", async () => {
    const resultado = await importarViaIa(dadosDoArquivo(Math.round(4.8 * 1024 * 1024)));

    expect(resultado).toMatchObject({ ok: false, status: 413, erro: expect.stringContaining("4 MB") });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("aceita exatamente 4 MB e envia o arquivo para o backend", async () => {
    const dados = dadosDoArquivo(4 * 1024 * 1024);

    expect(await importarViaIa(dados)).toEqual({ ok: true, dados: { importacaoId: "rascunho", quantidade: 2 } });
    expect(chamarBackend).toHaveBeenCalledWith("/importacoes-ia", {
      method: "POST",
      corpo: expect.any(FormData),
    });
    expect((chamarBackend.mock.calls[0][1].corpo as FormData).get("arquivo")).toBe(dados.get("arquivo"));
  });

  it("pede um arquivo quando ele está ausente", async () => {
    expect(await importarViaIa(new FormData())).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  const ERROS = [{ caminho: "lancamentos[0].valor", lancamento: 1, mensagem: "O valor precisa ser um número." }];

  it("usa o total do backend, não o tamanho da lista", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(422, "x", [], {}, undefined, ERROS, undefined, 200));
    expect(await importarViaIa(dadosDoArquivo(10))).toMatchObject({ erros: ERROS, totalErros: 200 });
  });

  it("sem o total, conta a lista", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(422, "x", [], {}, undefined, ERROS));
    expect(await importarViaIa(dadosDoArquivo(10))).toMatchObject({ totalErros: 1 });
  });
});

describe("nova versão da importação por IA", () => {
  const banco = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
  const sistemaAnterior = "ea0a9f44-d4d2-4d65-93bf-8494eb235a94";
  const novo = "28bb6ccb-28bf-4a0d-8dd1-4b9c9648c87a";
  const contexto = { banco, sistemaAnterior };
  const listar = `/execucoes?extrato_banco_id=${banco}&limit=100&offset=0`;
  const fechar = "/fechamentos?competencia=2026-10";
  const confirmar = `/importacoes-ia/${novo}/confirmar`;
  const rascunho = `/importacoes-ia/${novo}?limit=1000`;
  const extrato = `/extratos/${novo}`;
  const origem = {
    extrato_banco_id: banco,
    extrato_sistema_id: sistemaAnterior,
    nome_arquivo_banco: "banco.ofx",
    nome_arquivo_sistema: "sistema-v1.json",
    atual: true,
    executada_em: "2026-11-01T10:00:00Z",
    periodo_inicio: "2026-10-01",
    contagens: { total: 2 },
  };

  beforeEach(() => chamarBackend.mockReset());

  it("confirma o rascunho e concilia com o ID do banco original", async () => {
    chamarBackend
      .mockResolvedValueOnce({ total: 1, itens: [origem] })
      .mockResolvedValueOnce({ itens: [] })
      .mockResolvedValueOnce({ extrato_id: novo })
      .mockResolvedValueOnce({ total: 2 });

    expect(await concluirNovaVersaoIa(contexto, novo)).toEqual({ ok: true, dados: { extratoId: novo } });
    expect(chamarBackend).toHaveBeenNthCalledWith(1, listar);
    expect(chamarBackend).toHaveBeenNthCalledWith(2, fechar);
    expect(chamarBackend).toHaveBeenNthCalledWith(3, confirmar, { method: "POST" });
    expect(chamarBackend).toHaveBeenNthCalledWith(4, "/conciliacoes", {
      method: "POST",
      corpo: { extrato_banco_id: banco, extrato_sistema_id: novo },
      signal: expect.any(AbortSignal),
    });
  });

  it("retoma após timeout da conciliação com o mesmo ID e sem confirmar de novo", async () => {
    chamarBackend
      .mockResolvedValueOnce({ total: 1, itens: [origem] })
      .mockResolvedValueOnce({ itens: [] })
      .mockResolvedValueOnce({ extrato_id: novo })
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce({ total: 1, itens: [origem] })
      .mockResolvedValueOnce({ itens: [] })
      .mockRejectedValueOnce(new ErroBackend(409, "Importação já confirmada."))
      .mockResolvedValueOnce({ extrato_id: novo, origem: "sistema", status: "concluido" })
      .mockResolvedValueOnce({ total: 2 });

    expect(await concluirNovaVersaoIa(contexto, novo)).toMatchObject({ ok: false, status: 504, confirmada: true });
    expect(await concluirNovaVersaoIa(contexto, novo, true)).toEqual({ ok: true, dados: { extratoId: novo } });
    expect(chamarBackend.mock.calls.filter(([rota]) => rota === confirmar)).toHaveLength(1);
    expect(chamarBackend).toHaveBeenNthCalledWith(7, rascunho);
    expect(chamarBackend).toHaveBeenNthCalledWith(8, extrato);
    expect(chamarBackend.mock.calls.filter(([rota]) => rota === "/conciliacoes").map(([, opcoes]) => opcoes.corpo))
      .toEqual(Array(2).fill({ extrato_banco_id: banco, extrato_sistema_id: novo }));
  });

  it("abre a rodada já registrada quando a resposta da conciliação se perdeu", async () => {
    chamarBackend.mockResolvedValueOnce({
      total: 2,
      itens: [origem, { ...origem, extrato_sistema_id: novo, executada_em: "2026-11-02T10:00:00Z" }],
    });

    expect(await concluirNovaVersaoIa(contexto, novo, true)).toEqual({ ok: true, dados: { extratoId: novo } });
    expect(chamarBackend).toHaveBeenCalledExactlyOnceWith(listar);
  });

  it("recupera um extrato confirmado ao recarregar pelo ID do rascunho", async () => {
    chamarBackend
      .mockRejectedValueOnce(new ErroBackend(409, "Importação já confirmada."))
      .mockResolvedValueOnce({ extrato_id: novo, origem: "sistema", status: "concluido" });

    expect(await recuperarExtratoConfirmado(novo)).toEqual({ ok: true, dados: { extratoId: novo } });
    expect(chamarBackend.mock.calls).toEqual([[rascunho], [extrato]]);
  });

  it("mantém a revisão se a confirmação não foi aceita", async () => {
    chamarBackend
      .mockResolvedValueOnce({ total: 1, itens: [origem] })
      .mockResolvedValueOnce({ itens: [] })
      .mockRejectedValueOnce(new ErroBackend(422, "Importação sem lançamentos."));

    expect(await concluirNovaVersaoIa(contexto, novo)).toEqual({ ok: false, status: 422, erro: "Importação sem lançamentos." });
    expect(chamarBackend).toHaveBeenCalledTimes(3);
  });

  it("recusa a confirmação se o mês do banco fechou", async () => {
    chamarBackend
      .mockResolvedValueOnce({ total: 1, itens: [origem] })
      .mockResolvedValueOnce({ itens: [{ estado: "fechado" }] });

    expect(await concluirNovaVersaoIa(contexto, novo)).toMatchObject({ ok: false, status: 409, erro: expect.stringContaining("mês está fechado") });
    expect(chamarBackend.mock.calls).toEqual([[listar], [fechar]]);
  });

  it("recusa a confirmação se o banco está fora da empresa ativa", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Extrato não encontrado."));

    expect(await concluirNovaVersaoIa(contexto, novo)).toMatchObject({ ok: false, status: 404 });
    expect(chamarBackend).toHaveBeenCalledExactlyOnceWith(listar);
  });

  it("aguarda o histórico completo antes de tentar conciliar novamente", async () => {
    chamarBackend.mockResolvedValueOnce({ total: 2, itens: [origem] }).mockResolvedValueOnce({ itens: [] });

    expect(await concluirNovaVersaoIa(contexto, novo, true)).toMatchObject({ ok: false, status: 503 });
    expect(chamarBackend.mock.calls.map(([rota]) => rota)).toEqual([listar, listar.replace("offset=0", "offset=100")]);
  });
});

describe("saldo opcional no resumo do rascunho", () => {
  const id = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
  const linhaId = "ea0a9f44-d4d2-4d65-93bf-8494eb235a94";
  const lancamento = { id: linhaId, numero: 1, data: "2026-10-01", valor: "10.00", descricao: "Recebimento" };
  const resumoApi = { quantidade: 1, total_entradas: "10.00", total_saidas: "0.00", periodo_inicio: "2026-10-01", periodo_fim: "2026-10-01", expira_em: "2026-11-10T12:00:00Z" };
  const resumoEsperado = { quantidade: 1, totalEntradas: "10.00", totalSaidas: "0.00", periodoInicio: "2026-10-01", periodoFim: "2026-10-01", expiraEm: "2026-11-10T12:00:00Z" };

  beforeEach(() => chamarBackend.mockReset());

  it.each([
    { nome: "backend antigo", campos: {}, esperado: {} },
    { nome: "arquivo sem saldo", campos: { saldo_final: null, saldo_data: null }, esperado: { saldoFinal: null, saldoData: null } },
    { nome: "saldo zero", campos: { saldo_final: "0.00", saldo_data: "2026-10-01" }, esperado: { saldoFinal: "0.00", saldoData: "2026-10-01" } },
    { nome: "saldo negativo", campos: { saldo_final: "-250.75", saldo_data: "2026-10-01" }, esperado: { saldoFinal: "-250.75", saldoData: "2026-10-01" } },
  ])("preserva presença e valor dos campos: $nome", async ({ campos, esperado }) => {
    chamarBackend.mockResolvedValue({ importacao_id: id, resumo: { ...resumoApi, ...campos }, total: 1, itens: [lancamento] });
    const resultado = await carregarRascunho(id);
    expect(resultado.ok && resultado.dados.resumo).toEqual({ ...resumoEsperado, ...esperado });
  });

  it("mantém o saldo recebido também ao corrigir e acrescentar linhas", async () => {
    chamarBackend.mockResolvedValue({ lancamento, resumo: { ...resumoApi, saldo_final: "1234.56", saldo_data: "2026-10-01" } });
    const campos = { data: "2026-10-01", valor: "10.00", descricao: "Recebimento" };
    const resultados = [await corrigirLinhaDoRascunho(id, linhaId, campos), await acrescentarLinhaAoRascunho(id, campos)];
    for (const resultado of resultados) {
      expect(resultado.ok && resultado.dados.resumo).toMatchObject({ saldoFinal: "1234.56", saldoData: "2026-10-01" });
    }
  });
});

describe("linhas do rascunho: só os três campos chegam ao backend (S1-04)", () => {
  const id = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
  const linhaId = "ea0a9f44-d4d2-4d65-93bf-8494eb235a94";
  const lancamento = { id: linhaId, data: "2026-10-01", valor: "10.00", descricao: "x", valido: true, erros: [] };
  const resumoApi = { total: 1, validos: 1, invalidos: 0 };

  beforeEach(() => chamarBackend.mockReset());

  it("campo a mais não vai junto, ao corrigir nem ao acrescentar", async () => {
    chamarBackend.mockResolvedValue({ lancamento, resumo: resumoApi });
    const campos = { data: "2026-10-01", valor: "10.00", descricao: "x", extrato_id: "outro" };

    await corrigirLinhaDoRascunho(id, linhaId, campos);
    await acrescentarLinhaAoRascunho(id, campos);

    for (const [, opcoes] of chamarBackend.mock.calls) {
      expect(opcoes.corpo).toEqual({ data: "2026-10-01", valor: "10.00", descricao: "x" });
    }
  });

  it("campo que não é texto responde 422 sem chamar o backend", async () => {
    const campos = { data: "2026-10-01", valor: 10, descricao: "x" } as unknown as { data: string; valor: string; descricao: string };

    expect(await corrigirLinhaDoRascunho(id, linhaId, campos)).toMatchObject({ ok: false, status: 422 });
    expect(await acrescentarLinhaAoRascunho(id, campos)).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("importarDoSistema (backend #253)", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
    emailDaSessao.mockReset().mockResolvedValue("ana@telhacerta.com.br");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("valida formato, data real de calendário e ordem de <= ate antes de chamar o backend", async () => {
    expect(await importarDoSistema("2026-10-31", "2026-10-01")).toMatchObject({ ok: false, status: 422 });
    expect(await importarDoSistema("2026-02-30", "2026-03-01")).toMatchObject({ ok: false, status: 422 });
    expect(await importarDoSistema("01/10/2026", "31/10/2026")).toMatchObject({ ok: false, status: 422 });
    expect(await importarDoSistema("", "2026-10-31")).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("conta de demonstração nunca chama POST /importacoes-ia/do-sistema", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@telhacerta.com.br");

    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toEqual({
      ok: false,
      status: 403,
      erro: "A conta de demonstração não pode ser alterada.",
      erros: [],
      totalErros: 0,
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("sucesso (201) manda { de, ate } e devolve importacaoId e quantidade no formato do importarViaIa", async () => {
    chamarBackend.mockResolvedValueOnce({
      importacao_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
      status: "rascunho",
      quantidade_lancamentos: 29,
      saldo_final: "40591.70",
      saldo_data: "2026-10-31",
    });

    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toEqual({
      ok: true,
      dados: { importacaoId: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", quantidade: 29 },
    });
    expect(chamarBackend).toHaveBeenCalledWith("/importacoes-ia/do-sistema", {
      method: "POST",
      corpo: { de: "2026-10-01", ate: "2026-10-31" },
    });
  });

  it.each([
    [409, "integracao_nao_configurada", "Esta empresa ainda não configurou a integração com o sistema."],
    [503, "integracao_indisponivel", "Integração com o sistema indisponível no momento."],
    [422, "sistema_sem_lancamentos", "O sistema não tem lançamentos nesse período."],
    [502, "sistema_recusou_a_chave", "O sistema recusou a chave. Confira a chave da integração em Configurações."],
    [502, "sistema_nao_respondeu", "O sistema não respondeu. Tente de novo ou envie o arquivo."],
    [502, "sistema_indisponivel", "O sistema está com problemas agora. Tente de novo ou envie o arquivo."],
    [502, "sistema_redirecionou", "O endereço do sistema redirecionou. Confira a URL da integração."],
    [502, "sistema_resposta_grande_demais", "O sistema devolveu um arquivo maior que 5 MB. Escolha um período menor."],
    [502, "sistema_resposta_invalida", "O arquivo devolvido não é um JSON válido."],
    [502, "sistema_endereco_nao_permitido", "O endereço do sistema não é permitido. Confira a configuração da integração."],
  ])("preserva codigo=%s e detail do backend no status %i", async (status, codigo, detalhe) => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(status, detalhe, [], {}, undefined, [], codigo));

    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toEqual({
      ok: false,
      status,
      codigo,
      erro: detalhe,
      erros: [],
      totalErros: 0,
    });
  });

  it("sistema_resposta_invalida fora do schema preserva erros e totalErros", async () => {
    const erros = [{ caminho: "lancamentos[0].valor", lancamento: 1, mensagem: "Valor inválido." }];
    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(502, "O arquivo não passou na conferência", [], {}, undefined, erros, "sistema_resposta_invalida", 62),
    );

    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toEqual({
      ok: false,
      status: 502,
      codigo: "sistema_resposta_invalida",
      erro: "O arquivo não passou na conferência",
      erros,
      totalErros: 62,
    });
  });

  it("401 sem codigo é sessão expirada; 403 conta_inativa e 422 sem codigo preservam detail; 429 e 5xx/rede são traduzidos", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(401, "Unauthorized"));
    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toEqual({
      ok: false,
      status: 401,
      erro: "Sua sessão expirou. Entre de novo para continuar.",
      erros: [],
      totalErros: 0,
    });

    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(403, "Conta inativa.", [], {}, undefined, [], "conta_inativa"),
    );
    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toMatchObject({
      ok: false,
      status: 403,
      codigo: "conta_inativa",
      erro: "Conta inativa.",
    });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(422, "O período máximo é de 90 dias."));
    expect(await importarDoSistema("2026-01-01", "2026-10-31")).toMatchObject({
      ok: false,
      status: 422,
      erro: "O período máximo é de 90 dias.",
    });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(429, "Rate limit"));
    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toMatchObject({
      ok: false,
      status: 429,
      erro: expect.stringMatching(/Muitas tentativas/),
    });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(500, "Internal Server Error"));
    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toMatchObject({
      ok: false,
      status: 500,
      erro: SEM_SERVIDOR,
    });

    chamarBackend.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await importarDoSistema("2026-10-01", "2026-10-31")).toMatchObject({
      ok: false,
      status: 0,
      erro: SEM_SERVIDOR,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { concluirNovaVersaoIa, importarViaIa, recuperarExtratoConfirmado } from "./acoes";

const chamarBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
}));

function dadosDoArquivo(tamanho: number): FormData {
  const arquivo = new File(["{}"], "resposta.json", { type: "application/json" });
  Object.defineProperty(arquivo, "size", { value: tamanho });
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  return dados;
}

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

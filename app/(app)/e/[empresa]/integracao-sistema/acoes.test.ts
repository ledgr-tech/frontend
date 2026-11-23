import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import type { Papel } from "@/lib/papel";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import {
  carregarIntegracaoSistema,
  removerIntegracaoSistema,
  salvarIntegracaoSistema,
} from "./acoes";

const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));
const conta = vi.hoisted(() => ({ papel: "admin" as Papel, indisponivel: false }));
vi.mock("../../../../(auth)/acoes", () => ({
  contaDaSessao: async () => ({ papel: conta.papel, ...(conta.indisponivel && { indisponivel: true as const }) }),
}));

const CONFIGURADA_API = {
  configurada: true,
  adaptador: "ledgr_v1",
  url: "https://erp.exemplo.com.br",
  chave_prefixo: "sk_live_ab",
  atualizada_em: "2026-11-22T15:00:00Z",
  atualizada_por: "Maria",
};

const CONFIGURADA = {
  configurada: true,
  adaptador: "ledgr_v1",
  url: "https://erp.exemplo.com.br",
  chavePrefixo: "sk_live_ab",
  atualizadaEm: "2026-11-22T15:00:00Z",
  atualizadaPor: "Maria",
};

beforeEach(() => {
  chamarBackend.mockReset();
  emailDaSessao.mockReset().mockResolvedValue("maria@telhacerta.com.br");
  conta.papel = "admin";
  conta.indisponivel = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("carregarIntegracaoSistema", () => {
  it("lê e adapta o estado atual da empresa ativa sem retornar chave", async () => {
    chamarBackend.mockResolvedValueOnce(CONFIGURADA_API);

    expect(await carregarIntegracaoSistema()).toEqual({ ok: true, dados: CONFIGURADA });
    expect(chamarBackend).toHaveBeenCalledWith("/empresa/integracao-sistema");
  });

  it("permite também ao gestor", async () => {
    conta.papel = "gestor";
    chamarBackend.mockResolvedValueOnce({
      configurada: false,
      adaptador: null,
      url: null,
      chave_prefixo: null,
      atualizada_em: null,
      atualizada_por: null,
    });

    expect(await carregarIntegracaoSistema()).toMatchObject({ ok: true, dados: { configurada: false } });
  });

  it("falha de rede ou 500 viram SEM_SERVIDOR", async () => {
    chamarBackend.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await carregarIntegracaoSistema()).toEqual({ ok: false, status: 0, erro: SEM_SERVIDOR });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(500, "Internal Server Error"));
    expect(await carregarIntegracaoSistema()).toEqual({ ok: false, status: 500, erro: SEM_SERVIDOR });
  });
});

describe("salvarIntegracaoSistema", () => {
  it("manda URL e chave aparadas no PUT e nunca devolve a chave recebida", async () => {
    chamarBackend.mockResolvedValueOnce(CONFIGURADA_API);

    const resultado = await salvarIntegracaoSistema("  https://erp.exemplo.com.br  ", "  segredo-super-privado  ");

    expect(resultado).toEqual({ ok: true, dados: CONFIGURADA });
    expect(chamarBackend).toHaveBeenCalledWith("/empresa/integracao-sistema", {
      method: "PUT",
      corpo: { url: "https://erp.exemplo.com.br", chave: "segredo-super-privado" },
    });
    expect(JSON.stringify(resultado)).not.toContain("segredo-super-privado");
  });

  it("nunca devolve chave curta inteira mesmo se o backend retornar a chave inteira em chave_prefixo", async () => {
    chamarBackend.mockResolvedValueOnce({ ...CONFIGURADA_API, chave_prefixo: "12345678" });
    const oito = await salvarIntegracaoSistema("https://erp.exemplo.com.br", "12345678");
    expect(oito.ok && oito.dados.chavePrefixo).toBe("1234");
    expect(JSON.stringify(oito)).not.toContain("12345678");

    chamarBackend.mockResolvedValueOnce({ ...CONFIGURADA_API, chave_prefixo: "abc" });
    const tres = await salvarIntegracaoSistema("https://erp.exemplo.com.br", "abc");
    expect(tres.ok && tres.dados.chavePrefixo).toBeNull();
    expect(JSON.stringify(tres)).not.toContain("abc");
  });

  it("remove a chave enviada caso o backend a inclua numa mensagem de erro de validação", async () => {
    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(422, "Chave inválida: segredo-curto-8", [], {}),
    );
    const rTexto = await salvarIntegracaoSistema("https://erp.exemplo.com.br", "segredo-curto-8");
    expect(rTexto).toMatchObject({ ok: false, status: 422, campo: "chave" });
    expect(!rTexto.ok && rTexto.erro).not.toContain("segredo-curto-8");

    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(422, "O servidor respondeu 422.", ["chave"], { chave: "Value error, chave 'abc' curta demais" }),
    );
    const rPydantic = await salvarIntegracaoSistema("https://erp.exemplo.com.br", "abc");
    expect(rPydantic).toMatchObject({ ok: false, status: 422, campo: "chave" });
    expect(!rPydantic.ok && rPydantic.erro).not.toContain("abc");

    // chave de 1 caractere ("a") não corrompe palavras comuns em erro de URL
    chamarBackend.mockRejectedValueOnce(new ErroBackend(422, "Confira a URL informada."));
    expect(await salvarIntegracaoSistema("http://erp.local", "a")).toEqual({
      ok: false,
      status: 422,
      campo: "url",
      erro: "Confira a URL informada.",
    });
  });

  it("recusa URL vazia, URL longa demais ou chave vazia sem chamar o backend", async () => {
    expect(await salvarIntegracaoSistema("   ", "chave")).toMatchObject({ ok: false, status: 422, campo: "url" });
    expect(await salvarIntegracaoSistema(`https://a.com/${"x".repeat(2050)}`, "chave")).toMatchObject({
      ok: false,
      status: 422,
      campo: "url",
    });
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "   ")).toMatchObject({
      ok: false,
      status: 422,
      campo: "chave",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("422 do backend aparece no campo com o texto dele, seja detail em texto ou lista Pydantic", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(422, "Use um endereço HTTPS público."));
    expect(await salvarIntegracaoSistema("http://erp.exemplo.com.br", "chave-123")).toEqual({
      ok: false,
      status: 422,
      campo: "url",
      erro: "Use um endereço HTTPS público.",
    });

    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(422, "O servidor respondeu 422.", ["chave"], { chave: "Value error, chave curta demais" }),
    );
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "x")).toEqual({
      ok: false,
      status: 422,
      campo: "chave",
      erro: "chave curta demais",
    });
  });

  it("403 conta_inativa preserva o texto do backend; 403 comum usa o texto de papel", async () => {
    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(403, "Esta conta está inativa.", [], {}, undefined, [], "conta_inativa"),
    );
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")).toEqual({
      ok: false,
      status: 403,
      codigo: "conta_inativa",
      erro: "Esta conta está inativa.",
    });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(403, "Forbidden"));
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")).toEqual({
      ok: false,
      status: 403,
      erro: "Só o admin ou o gestor do escritório configuram a integração com o sistema.",
    });
  });

  it("503 integracao_indisponivel preserva o detail do backend", async () => {
    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(503, "Integração com o sistema indisponível no momento.", [], {}, undefined, [], "integracao_indisponivel"),
    );
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")).toEqual({
      ok: false,
      status: 503,
      codigo: "integracao_indisponivel",
      erro: "Integração com o sistema indisponível no momento.",
    });
  });

  it("401 e 429 chegam traduzidos", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(401, "Unauthorized"));
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")).toMatchObject({
      ok: false,
      status: 401,
    });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(429, "Rate limit"));
    expect(await salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")).toMatchObject({
      ok: false,
      status: 429,
      erro: expect.stringMatching(/Muitas tentativas/),
    });
  });
});

describe("removerIntegracaoSistema", () => {
  it("chama DELETE e trata só o 404 exato de sem integração como sucesso; outros 404 viram erro", async () => {
    chamarBackend.mockResolvedValueOnce(undefined);
    expect(await removerIntegracaoSistema()).toEqual({ ok: true, dados: null });
    expect(chamarBackend).toHaveBeenCalledWith("/empresa/integracao-sistema", { method: "DELETE" });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Esta empresa não tem integração configurada."));
    expect(await removerIntegracaoSistema()).toEqual({ ok: true, dados: null });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Empresa não encontrada."));
    expect(await removerIntegracaoSistema()).toEqual({
      ok: false,
      status: 404,
      erro: "Empresa não encontrada.",
    });

    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found"));
    expect(await removerIntegracaoSistema()).toEqual({
      ok: false,
      status: 404,
      erro: "A integração com o sistema não está disponível no momento.",
    });
  });

  it("propaga 403 conta_inativa na remoção", async () => {
    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(403, "Esta conta está inativa.", [], {}, undefined, [], "conta_inativa"),
    );
    expect(await removerIntegracaoSistema()).toEqual({
      ok: false,
      status: 403,
      codigo: "conta_inativa",
      erro: "Esta conta está inativa.",
    });
  });
});

describe("bloqueios antes do backend", () => {
  it.each([
    ["carregarIntegracaoSistema", () => carregarIntegracaoSistema()],
    ["salvarIntegracaoSistema", () => salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")],
    ["removerIntegracaoSistema", () => removerIntegracaoSistema()],
  ])("analista recebe 403 em %s sem chamar o backend", async (_, acao) => {
    conta.papel = "analista";
    expect(await acao()).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it.each([
    ["carregarIntegracaoSistema", () => carregarIntegracaoSistema()],
    ["salvarIntegracaoSistema", () => salvarIntegracaoSistema("https://erp.exemplo.com.br", "chave-123")],
    ["removerIntegracaoSistema", () => removerIntegracaoSistema()],
  ])("conta de demonstração nunca chama o backend em %s", async (_, acao) => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "maria@telhacerta.com.br");
    expect(await acao()).toEqual({
      ok: false,
      status: 403,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("com /me indisponível, recusa com 503 sem chamar o backend", async () => {
    conta.papel = "analista";
    conta.indisponivel = true;
    expect(await carregarIntegracaoSistema()).toMatchObject({ ok: false, status: 503 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

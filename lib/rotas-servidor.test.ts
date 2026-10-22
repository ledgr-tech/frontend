// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { caminhoDoApp, empresaDaRequisicao, redirecionarNoApp } from "./rotas-servidor";

const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";

// os cabeçalhos do pedido que o proxy deixou; `null` = fora de uma requisição (o `headers()` lança)
const requisicao = vi.hoisted(() => ({ cabecalhos: {} as Record<string, string> | null }));
vi.mock("next/headers", () => ({
  headers: async () => {
    if (!requisicao.cabecalhos) throw new Error("`headers` was called outside a request scope.");
    return new Headers(requisicao.cabecalhos);
  },
}));

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

beforeEach(() => {
  requisicao.cabecalhos = {};
  redirect.mockReset();
});

describe("empresaDaRequisicao", () => {
  it("lê a empresa que o proxy deixou no pedido", async () => {
    requisicao.cabecalhos = { "x-ledgr-empresa": A };
    expect(await empresaDaRequisicao()).toBe(A);
  });

  it("sem cabeçalho, ou com um que não é UUID, não há empresa", async () => {
    expect(await empresaDaRequisicao()).toBeNull();
    requisicao.cabecalhos = { "x-ledgr-empresa": "lixo" };
    expect(await empresaDaRequisicao()).toBeNull();
  });

  it("fora de uma requisição (o build, por exemplo), não há empresa e nada lança", async () => {
    requisicao.cabecalhos = null;
    expect(await empresaDaRequisicao()).toBeNull();
  });
});

describe("caminhoDoApp", () => {
  it("prefixa as telas da empresa com a da requisição", async () => {
    requisicao.cabecalhos = { "x-ledgr-empresa": A };
    expect(await caminhoDoApp("/extratos")).toBe(`/e/${A}/extratos`);
    expect(await caminhoDoApp("/fechamentos?mes=2026-09")).toBe(`/e/${A}/fechamentos?mes=2026-09`);
  });

  it("deixa como está o que não é tela da empresa, e tudo sem empresa na requisição", async () => {
    requisicao.cabecalhos = { "x-ledgr-empresa": A };
    expect(await caminhoDoApp("/login")).toBe("/login");
    requisicao.cabecalhos = {};
    expect(await caminhoDoApp("/extratos")).toBe("/extratos");
  });
});

describe("redirecionarNoApp", () => {
  it("redireciona para o caminho já com a empresa da requisição", async () => {
    requisicao.cabecalhos = { "x-ledgr-empresa": A };
    await expect(redirecionarNoApp("/fechamentos")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/e/${A}/fechamentos`);
  });

  it("para fora do app, redireciona como veio", async () => {
    requisicao.cabecalhos = { "x-ledgr-empresa": A };
    await expect(redirecionarNoApp("/login")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import type { Papel } from "@/lib/papel";
import { carregarChavesApi, criarChaveApi, revogarChaveApi } from "./acoes";

// a rede é a fronteira; ErroBackend e a tradução dos erros rodam de verdade
const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));
const conta = vi.hoisted(() => ({ papel: "admin" as Papel }));
vi.mock("../../../../(auth)/acoes", () => ({ contaDaSessao: async () => ({ papel: conta.papel }) }));

const EMPRESA = "5c0f2a8e-1b3d-4e6f-9a7b-2c4d6e8f0a1b";
const CHAVE = "8e1d3c5b-7a9f-4b2d-8c6e-0f1a3b5c7d9e";
const chaveApi = {
  id: CHAVE,
  nome: "Planilha do financeiro",
  prefixo: "Ab12Cd34",
  escopo: { tipo: "empresa", empresa_id: EMPRESA, razao_social: "Telha Certa Ltda" },
  criada_por: "Ana",
  criado_em: "2026-10-22T12:00:00Z",
  ultimo_uso_em: null,
  revogada_em: null,
};
const chave = {
  id: CHAVE,
  nome: "Planilha do financeiro",
  prefixo: "Ab12Cd34",
  empresa: { id: EMPRESA, razaoSocial: "Telha Certa Ltda" },
  criadaPor: "Ana",
  criadoEm: "2026-10-22T12:00:00Z",
  ultimoUsoEm: null,
  revogadaEm: null,
};

beforeEach(() => {
  chamarBackend.mockReset();
  emailDaSessao.mockResolvedValue("ana@x.com");
  conta.papel = "admin";
  vi.stubEnv("LEDGR_API_URL", "https://api.ledgr.test/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("carregarChavesApi", () => {
  it("adapta o escopo da empresa e o da conta, e diz o endereço da API sem a barra do fim", async () => {
    chamarBackend.mockResolvedValueOnce({ itens: [chaveApi, { ...chaveApi, id: "c2", escopo: { tipo: "conta" } }] });

    expect(await carregarChavesApi()).toEqual({
      ok: true,
      dados: { itens: [chave, { ...chave, id: "c2", empresa: null }], endereco: "https://api.ledgr.test" },
    });
    expect(chamarBackend).toHaveBeenCalledWith("/chaves-api");
  });

  it("um backend antes do #135 responde 404, e o 404 chega à tela", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found"));

    expect(await carregarChavesApi()).toMatchObject({ ok: false, status: 404 });
  });
});

describe("criarChaveApi", () => {
  it("manda o nome aparado e a empresa, e devolve o token só desta resposta", async () => {
    chamarBackend.mockResolvedValueOnce({ ...chaveApi, chave: "ledgr_Ab12Cd34resto" });

    expect(await criarChaveApi("  Planilha do financeiro ", EMPRESA)).toEqual({
      ok: true,
      dados: { chave, token: "ledgr_Ab12Cd34resto" },
    });
    expect(chamarBackend).toHaveBeenCalledWith("/chaves-api", {
      method: "POST",
      corpo: { nome: "Planilha do financeiro", empresa_id: EMPRESA },
    });
  });

  it("sem empresa, a chave vale para todas: o corpo vai sem empresa_id", async () => {
    chamarBackend.mockResolvedValueOnce({ ...chaveApi, escopo: { tipo: "conta" }, chave: "ledgr_x" });

    await criarChaveApi("Todas", null);

    expect(chamarBackend).toHaveBeenCalledWith("/chaves-api", { method: "POST", corpo: { nome: "Todas" } });
  });

  it("o limite de 10 ativas (409) chega com o texto do backend", async () => {
    chamarBackend.mockRejectedValueOnce(
      new ErroBackend(409, "Sua conta já tem 10 chaves ativas. Revogue uma antes de criar outra."),
    );

    expect(await criarChaveApi("Outra", null)).toEqual({
      ok: false,
      status: 409,
      erro: "Sua conta já tem 10 chaves ativas. Revogue uma antes de criar outra.",
    });
  });

  it("não manda ao backend nome vazio, longo demais ou empresa sem formato de id", async () => {
    expect(await criarChaveApi("   ", null)).toMatchObject({ status: 422 });
    expect(await criarChaveApi("x".repeat(61), null)).toMatchObject({ status: 422 });
    expect(await criarChaveApi("Ok", "../empresas")).toMatchObject({ status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("revogarChaveApi", () => {
  it("revoga pelo id", async () => {
    chamarBackend.mockResolvedValueOnce(undefined);

    expect(await revogarChaveApi(CHAVE)).toEqual({ ok: true, dados: null });
    expect(chamarBackend).toHaveBeenCalledWith(`/chaves-api/${CHAVE}`, { method: "DELETE" });
  });

  it("não manda ao backend um id sem formato de uuid", async () => {
    expect(await revogarChaveApi("../me")).toMatchObject({ status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("quem não pode", () => {
  it.each([
    ["carregarChavesApi", () => carregarChavesApi()],
    ["criarChaveApi", () => criarChaveApi("Planilha", null)],
    ["revogarChaveApi", () => revogarChaveApi(CHAVE)],
  ])("o analista recebe 403 em %s, sem chamar o backend", async (_, acao) => {
    conta.papel = "analista";

    expect(await acao()).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("a conta de demonstração não cria chave", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@x.com");

    expect(await criarChaveApi("Planilha", null)).toEqual({
      ok: false,
      status: 403,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("a conta de demonstração lê a lista, mesmo sem poder criar nem revogar", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@x.com");
    chamarBackend.mockResolvedValueOnce({ itens: [] });

    expect(await carregarChavesApi()).toMatchObject({ ok: true });
    expect(await revogarChaveApi(CHAVE)).toMatchObject({ ok: false, status: 403 });
  });

  it("o 403 do backend chega com o texto da tela", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(403, "Forbidden"));

    expect(await revogarChaveApi(CHAVE)).toEqual({
      ok: false,
      status: 403,
      erro: "Só o admin ou o gestor da conta criam e revogam chaves da API.",
    });
  });
});

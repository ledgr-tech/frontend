// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import UrlSemEmpresa from "./page";

const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const B = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const EMPRESAS = [
  { id: A, razaoSocial: "Padaria Ltda", cnpj: "1" },
  { id: B, razaoSocial: "Mercado Ltda", cnpj: "2" },
];

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: () => auth() }));

const contaDaSessao = vi.hoisted(() => vi.fn());
vi.mock("@/app/(auth)/acoes", () => ({ contaDaSessao: () => contaDaSessao() }));

const cookie = vi.hoisted(() => ({ valor: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (nome === "ledgr-empresa-recente" && cookie.valor !== undefined ? { value: cookie.valor } : undefined),
  }),
}));

const redirect = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  // o redirect e o notFound do Next interrompem a renderização lançando; os mocks imitam isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    notFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

async function abrir(secao: string, resto?: string[], busca: Record<string, string | string[] | undefined> = {}) {
  return UrlSemEmpresa({ params: Promise.resolve({ secao, resto }), searchParams: Promise.resolve(busca) });
}

beforeEach(() => {
  auth.mockReset();
  contaDaSessao.mockReset();
  redirect.mockReset();
  notFound.mockReset();
  cookie.valor = undefined;
  auth.mockResolvedValue({ user: { email: "ana@x.com", empresaId: A } });
  contaDaSessao.mockResolvedValue({ empresas: EMPRESAS });
});

describe("URL sem empresa", () => {
  it("sem sessão, vai ao login", async () => {
    auth.mockResolvedValue(null);
    await expect(abrir("visao-geral")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("leva à empresa recente do cookie, com o resto e a query", async () => {
    cookie.valor = B;
    await expect(abrir("fechamentos", undefined, { mes: "2026-09" })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/e/${B}/fechamentos?mes=2026-09`);
  });

  it("um cookie malformado, ou de empresa que sumiu, cai na primeira da lista", async () => {
    for (const valor of ["lixo", "5a5a5a5a-1b2c-4d3e-8f4a-0b1c2d3e4f5a", ""]) {
      redirect.mockReset();
      cookie.valor = valor;
      await expect(abrir("extratos")).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith(`/e/${A}/extratos`);
    }
  });

  it("sem cookie, usa a primeira empresa", async () => {
    await expect(abrir("historico")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/e/${A}/historico`);
  });

  it("guarda a query de uma comparação, e a tela de nova conciliação", async () => {
    await expect(abrir("conciliacoes", [B], { sistema: A })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/e/${A}/conciliacoes/${B}?sistema=${A}`);
    redirect.mockReset();
    await expect(abrir("conciliacoes", ["nova"])).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/e/${A}/conciliacoes/nova`);
  });

  it("sem a lista de empresas (backend anterior ao #133), usa a empresa da sessão", async () => {
    contaDaSessao.mockResolvedValue({ empresas: [] });
    await expect(abrir("visao-geral")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(`/e/${A}/visao-geral`);
  });

  it("sem lista e sem uma empresa de sessão que seja UUID, é 404", async () => {
    contaDaSessao.mockResolvedValue({ empresas: [] });
    auth.mockResolvedValue({ user: { email: "ana@x.com", empresaId: "lixo" } });
    await expect(abrir("visao-geral")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("não sai do site: redirect aberto e travessia dão 404, nunca redirect", async () => {
    for (const resto of [[""], [".."], ["%2f%2fevil.com"], ["a/b"], ["//evil.com"], [String.fromCharCode(92) + "evil"]]) {
      notFound.mockReset();
      await expect(abrir("extratos", resto)).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(redirect).not.toHaveBeenCalled();
  });

  it("o que não é seção do app dá 404, nem chegando a pedir sessão", async () => {
    for (const secao of ["login", "e", "qualquer", "api"]) {
      await expect(abrir(secao)).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(auth).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baixarDoBackend, chamarBackend, ErroBackend } from "./backend";

// o cookie da sessão é o JWT; aqui ele é só uma string conhecida
const cookie = vi.hoisted(() => ({ valor: "jwt-de-teste" as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "authjs.session-token" && cookie.valor ? { value: cookie.valor } : undefined,
  }),
}));

// "Status;Valor" com o BOM do UTF-8 na frente, como o backend manda o CSV
const BOM = [0xef, 0xbb, 0xbf];
const CSV = new Uint8Array([...BOM, ...new TextEncoder().encode("Status;Valor\r\nMatch exato;10,00\r\n")]);

const fetch = vi.fn();

describe("baixarDoBackend", () => {
  beforeEach(() => {
    cookie.valor = "jwt-de-teste";
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve a resposta crua, com o token no cabeçalho e os bytes intactos", async () => {
    fetch.mockResolvedValue(new Response(CSV, { headers: { "Content-Type": "text/csv; charset=utf-8" } }));

    const resposta = await baixarDoBackend("/conciliacoes/b/exportar");

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/conciliacoes/b/exportar");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer jwt-de-teste");
    // sem decodificar como texto: é o que preserva o BOM que o Excel precisa
    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(CSV);
    expect(resposta.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });

  it("sem sessão, recusa antes de chamar o backend", async () => {
    cookie.valor = undefined;

    await expect(baixarDoBackend("/conciliacoes/b/exportar")).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("traz o status e o detalhe do erro do backend", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Extrato não encontrado." }, { status: 404 }));

    const erro = await baixarDoBackend("/conciliacoes/b/exportar").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroBackend);
    expect(erro).toMatchObject({ status: 404, detalhe: "Extrato não encontrado." });
  });
});

describe("chamarBackend", () => {
  beforeEach(() => {
    cookie.valor = "jwt-de-teste";
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("na chamada pública, vai sem Bearer mesmo sem sessão — é onde a sessão nasce", async () => {
    cookie.valor = undefined;
    fetch.mockResolvedValue(Response.json({ id: "u" }));

    await chamarBackend("/login", { method: "POST", corpo: { email: "a@b.com", senha: "x" }, publica: true });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("do 422 do FastAPI, guarda quais campos do corpo foram recusados", async () => {
    fetch.mockResolvedValue(
      Response.json(
        {
          detail: [
            { type: "value_error", loc: ["body", "cnpj"], msg: "Value error, CNPJ inválido" },
            { type: "missing", loc: ["body", "razao_social"], msg: "Field required" },
          ],
        },
        { status: 422 },
      ),
    );

    const erro = await chamarBackend("/register", { method: "POST", corpo: {}, publica: true }).catch(
      (e: unknown) => e,
    );

    expect(erro).toMatchObject({ status: 422, campos: ["cnpj", "razao_social"] });
  });
});

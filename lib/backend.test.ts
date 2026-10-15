import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baixarDoBackend, chamarBackend, ErroBackend } from "./backend";

// o cookie da sessão é o JWT; aqui ele é só uma string conhecida
const cookie = vi.hoisted(() => ({ valor: "jwt-de-teste" as string | undefined }));
// os cabeçalhos que a Vercel escreve na requisição do navegador; `null` = fora de uma requisição
const requisicao = vi.hoisted(() => ({ cabecalhos: {} as Record<string, string> | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "authjs.session-token" && cookie.valor ? { value: cookie.valor } : undefined,
  }),
  headers: async () => {
    if (!requisicao.cabecalhos) throw new Error("`headers` was called outside a request scope.");
    return new Headers(requisicao.cabecalhos);
  },
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

  // sem prazo, um backend que aceita a conexão e não responde prende a tela até a hospedagem desistir
  it("sai sempre com um prazo, mesmo quando quem chama não deu um", async () => {
    fetch.mockResolvedValue(Response.json({}));

    await chamarBackend("/execucoes");

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal!.aborted).toBe(false);
  });

  it("o prazo de quem chama vale no lugar do padrão", async () => {
    fetch.mockResolvedValue(Response.json({}));
    const prazo = new AbortController().signal;

    await chamarBackend("/conciliacoes", { method: "POST", corpo: {}, signal: prazo });

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(prazo);
  });
});

// O backend limita /login, /register e /senha/* por IP (backend #64), e quem chama é o servidor do
// Next: sem repassar o IP do navegador, uma pessoa errando a senha trava o login de todo mundo.
describe("IP do navegador nas chamadas públicas", () => {
  const SEGREDO = "segredo-de-teste";

  beforeEach(() => {
    cookie.valor = "jwt-de-teste";
    requisicao.cabecalhos = { "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" };
    fetch.mockReset();
    fetch.mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("LEDGR_SEGREDO_PROXY", SEGREDO);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function cabecalhosDoLogin() {
    await chamarBackend("/login", { method: "POST", corpo: {}, publica: true });
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    return new Headers(init.headers);
  }

  it("manda o IP do x-real-ip junto com o segredo", async () => {
    const cabecalhos = await cabecalhosDoLogin();

    expect(cabecalhos.get("X-Ledgr-IP-Cliente")).toBe("203.0.113.7");
    expect(cabecalhos.get("X-Ledgr-Segredo-Proxy")).toBe(SEGREDO);
  });

  it("sem x-real-ip, usa o primeiro item do x-forwarded-for", async () => {
    requisicao.cabecalhos = { "x-forwarded-for": "198.51.100.1, 10.0.0.1" };

    expect((await cabecalhosDoLogin()).get("X-Ledgr-IP-Cliente")).toBe("198.51.100.1");
  });

  it("sem o segredo configurado, não manda nenhum dos dois", async () => {
    vi.stubEnv("LEDGR_SEGREDO_PROXY", "");

    const cabecalhos = await cabecalhosDoLogin();

    expect(cabecalhos.has("X-Ledgr-IP-Cliente")).toBe(false);
    expect(cabecalhos.has("X-Ledgr-Segredo-Proxy")).toBe(false);
  });

  it("fora de uma requisição (headers() lança), chama o backend sem eles", async () => {
    requisicao.cabecalhos = null;

    const cabecalhos = await cabecalhosDoLogin();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cabecalhos.has("X-Ledgr-IP-Cliente")).toBe(false);
    expect(cabecalhos.has("X-Ledgr-Segredo-Proxy")).toBe(false);
  });

  it("sem IP na requisição, não manda o segredo sozinho", async () => {
    requisicao.cabecalhos = {};

    const cabecalhos = await cabecalhosDoLogin();

    expect(cabecalhos.has("X-Ledgr-IP-Cliente")).toBe(false);
    expect(cabecalhos.has("X-Ledgr-Segredo-Proxy")).toBe(false);
  });

  // as rotas logadas limitam pelo token: o segredo não precisa sair nelas
  it("nas chamadas com sessão, não manda", async () => {
    await chamarBackend("/execucoes");

    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("X-Ledgr-Segredo-Proxy")).toBe(false);
  });
});

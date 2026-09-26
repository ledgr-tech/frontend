import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsSignin } from "next-auth";
import { ErroBackend } from "./backend";
import { MuitasEntradas, autorizar } from "./login";

// o /login não usa sessão, mas o lib/backend importa cookies()
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const fetch = vi.fn();

describe("autorizar", () => {
  beforeEach(() => {
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("pergunta ao backend, sem Bearer, e devolve o usuário com o empresa_id dele", async () => {
    fetch.mockResolvedValue(
      Response.json({
        id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
        empresa_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
        nome: "Ana Souza",
        email: "ana@telhacerta.com.br",
      }),
    );

    expect(await autorizar("Ana@TelhaCerta.com.br", "s3nha-forte")).toEqual({
      id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
      email: "ana@telhacerta.com.br",
      name: "Ana Souza",
      empresaId: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ email: "Ana@TelhaCerta.com.br", senha: "s3nha-forte" });
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("recusa com null no 401, que é igual para e-mail sem conta e senha errada", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "E-mail ou senha inválidos." }, { status: 401 }));

    expect(await autorizar("ana@telhacerta.com.br", "errada")).toBeNull();
  });

  it("no 429 lança um CredentialsSignin próprio, para a tela dizer 'espere' e não 'senha errada'", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Rate limit exceeded" }, { status: 429 }));

    const erro = await autorizar("ana@telhacerta.com.br", "s3nha-forte").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(MuitasEntradas);
    expect(erro).toBeInstanceOf(CredentialsSignin);
  });

  it("deixa subir o erro do backend fora do ar, que não é culpa de quem digitou", async () => {
    fetch.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));

    const erro = await autorizar("ana@telhacerta.com.br", "s3nha-forte").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroBackend);
    expect(erro).not.toBeInstanceOf(CredentialsSignin);
  });
});

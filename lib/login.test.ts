import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsSignin } from "next-auth";
import { ErroBackend } from "./backend";
import {
  MuitasEntradas,
  aceitarConviteNoBackendComGoogle,
  aoVoltarDoGoogle,
  autorizar,
  autorizarDepoisDoCadastroGoogle,
  entrarNoBackendComGoogle,
} from "./login";

// o /login não usa sessão, mas o lib/backend importa cookies(); o Google guarda o id_token num cookie
const cookiesExistentes = new Map<string, string>();
const cookiesGravados = vi.fn();
const cookiesApagados = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (cookiesExistentes.has(nome) ? { name: nome, value: cookiesExistentes.get(nome) } : undefined),
    set: (...args: unknown[]) => cookiesGravados(...args),
    delete: (...args: unknown[]) => cookiesApagados(...args),
  }),
}));

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

  it("repassa o auth_time do backend, sem calcular nada no front (#75)", async () => {
    fetch.mockResolvedValue(
      Response.json({
        id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
        empresa_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
        nome: "Ana Souza",
        email: "ana@telhacerta.com.br",
        auth_time: 1791374400,
      }),
    );

    expect(await autorizar("ana@telhacerta.com.br", "s3nha-forte")).toMatchObject({ authTime: 1791374400 });
  });

  it("backend sem auth_time na resposta: o usuário entra sem ele", async () => {
    fetch.mockResolvedValue(
      Response.json({
        id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
        empresa_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
        nome: "Ana Souza",
        email: "ana@telhacerta.com.br",
      }),
    );

    expect(await autorizar("ana@telhacerta.com.br", "s3nha-forte")).not.toHaveProperty("authTime");
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

describe("login pelo Google (backend #73)", () => {
  const USUARIO = {
    id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
    empresa_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
    nome: "Ana Souza",
    email: "ana@gmail.com",
    auth_time: 1791374400,
  };

  beforeEach(() => {
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
    cookiesExistentes.clear();
    cookiesGravados.mockReset();
    cookiesApagados.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  it("manda o id_token ao /login/google, sem Bearer, e usa o id e o empresa_id do backend", async () => {
    respostaDoBackend(200, USUARIO);

    expect(await entrarNoBackendComGoogle("id-token-do-google")).toEqual({
      ok: true,
      usuario: {
        id: USUARIO.id,
        email: "ana@gmail.com",
        name: "Ana Souza",
        empresaId: USUARIO.empresa_id,
        authTime: 1791374400,
      },
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/login/google");
    expect(JSON.parse(String(init.body))).toEqual({ id_token: "id-token-do-google" });
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("traduz cada recusa do backend num motivo", async () => {
    const casos: [number, string][] = [
      [404, "sem_conta"],
      [409, "email_com_senha"],
      [401, "nao_confirmado"],
      [429, "muitas_tentativas"],
      [503, "indisponivel"],
      [500, "falha"],
    ];
    for (const [status, erro] of casos) {
      respostaDoBackend(status, { detail: "x" });
      expect(await entrarNoBackendComGoogle("t")).toEqual({ ok: false, erro });
    }
    fetch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await entrarNoBackendComGoogle("t")).toEqual({ ok: false, erro: "falha" });
  });

  it("na volta do Google com conta, troca o perfil do Google pelo usuário do backend", async () => {
    respostaDoBackend(200, USUARIO);
    const usuario = { id: "sub-do-google", email: "ana@gmail.com", name: "Ana", empresaId: "" };

    expect(await aoVoltarDoGoogle(usuario, "t")).toBe(true);
    // o sub do Google nunca vira o id da sessão
    expect(usuario).toMatchObject({ id: USUARIO.id, empresaId: USUARIO.empresa_id, authTime: 1791374400 });
  });

  it("sem conta, guarda o id_token num cookie httpOnly de 1 hora e leva ao cadastro", async () => {
    respostaDoBackend(404, { detail: "Não há conta no Ledgr para esta conta Google." });

    expect(await aoVoltarDoGoogle({ empresaId: "" }, "id-token-do-google")).toBe("/cadastro/google");
    expect(cookiesGravados).toHaveBeenCalledWith(
      "ledgr-cadastro-google",
      "id-token-do-google",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 }),
    );
  });

  it("volta ao login com o motivo nas outras recusas, ou sem id_token", async () => {
    respostaDoBackend(409, { detail: "Já existe uma conta com este e-mail. Entre com e-mail e senha." });
    expect(await aoVoltarDoGoogle({ empresaId: "" }, "t")).toBe("/login?google=email_com_senha");

    expect(await aoVoltarDoGoogle({ empresaId: "" }, undefined)).toBe("/login?google=falha");
    expect(cookiesGravados).not.toHaveBeenCalled();
  });

  it("depois do cadastro, abre a sessão com o id_token do cookie e o apaga", async () => {
    cookiesExistentes.set("ledgr-cadastro-google", "id-token-do-google");
    respostaDoBackend(200, USUARIO);

    expect(await autorizarDepoisDoCadastroGoogle()).toMatchObject({ id: USUARIO.id, empresaId: USUARIO.empresa_id });
    expect(JSON.parse(String((fetch.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      id_token: "id-token-do-google",
    });
    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-cadastro-google");
  });

  it("sem o cookie, ou com o Google recusado, não abre sessão", async () => {
    expect(await autorizarDepoisDoCadastroGoogle()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();

    cookiesExistentes.set("ledgr-cadastro-google", "vencido");
    respostaDoBackend(401, { detail: "Não foi possível confirmar a conta Google." });
    expect(await autorizarDepoisDoCadastroGoogle()).toBeNull();
    expect(cookiesApagados).not.toHaveBeenCalled();
  });
});

describe("aceite do convite pelo Google (backend #69/#73)", () => {
  const USUARIO = {
    id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
    empresa_id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
    nome: "Ana Souza",
    email: "ana@gmail.com",
    auth_time: 1791374400,
  };

  beforeEach(() => {
    fetch.mockReset();
    vi.stubGlobal("fetch", fetch);
    cookiesExistentes.clear();
    cookiesGravados.mockReset();
    cookiesApagados.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  it("com o cookie do convite, aceita o convite em vez de entrar, e apaga o cookie", async () => {
    cookiesExistentes.set("ledgr-convite-google", "tok");
    respostaDoBackend(201, USUARIO);
    const usuario = { id: "sub-do-google", email: "ana@gmail.com", name: "Ana", empresaId: "" };

    expect(await aoVoltarDoGoogle(usuario, "id-tok")).toBe(true);

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/convites/aceitar/google");
    expect(JSON.parse(String(init.body))).toEqual({ token: "tok", id_token: "id-tok" });
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-convite-google");
    expect(usuario).toMatchObject({ id: USUARIO.id, empresaId: USUARIO.empresa_id, authTime: 1791374400 });
  });

  it.each([
    [409, "O e-mail da conta Google é diferente do e-mail convidado.", "/aceitar-convite?google=email_diferente", false],
    [409, "E-mail já cadastrado.", "/aceitar-convite?google=email_cadastrado", false],
    [400, "Convite inválido ou expirado. Peça um novo convite.", "/aceitar-convite?google=convite_invalido", true],
    [429, "Rate limit exceeded", "/aceitar-convite?google=muitas_tentativas", false],
    [500, "x", "/aceitar-convite?google=falha", false],
  ])("recusa %i (%s) volta para %s", async (status, detail, destino, apagaCookie) => {
    cookiesExistentes.set("ledgr-convite-google", "tok");
    respostaDoBackend(status, { detail });

    expect(await aoVoltarDoGoogle({ empresaId: "" }, "id-tok")).toBe(destino);
    if (apagaCookie) expect(cookiesApagados).toHaveBeenCalledWith("ledgr-convite-google");
    else expect(cookiesApagados).not.toHaveBeenCalled();
  });

  it("com o cookie do convite e sem id_token, volta ao convite com falha", async () => {
    cookiesExistentes.set("ledgr-convite-google", "tok");

    expect(await aoVoltarDoGoogle({ empresaId: "" }, undefined)).toBe("/aceitar-convite?google=falha");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sem o cookie do convite, segue o login pelo Google de hoje", async () => {
    respostaDoBackend(200, USUARIO);

    expect(await aoVoltarDoGoogle({ empresaId: "" }, "id-tok")).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/login/google");
  });

  it("aceitarConviteNoBackendComGoogle sem rede é falha", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));

    expect(await aceitarConviteNoBackendComGoogle("tok", "id-tok")).toEqual({ ok: false, erro: "falha" });
  });
});

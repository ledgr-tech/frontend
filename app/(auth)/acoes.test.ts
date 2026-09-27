import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsSignin } from "next-auth";
import { MuitasEntradas } from "@/lib/login";
import {
  cadastrar,
  entrar,
  entrarNaDemonstracao,
  excluirConta,
  razaoSocialDaEmpresa,
  trocarEmail,
  trocarSenha,
} from "./acoes";

// NextAuth, cookies e o backend são a fronteira externa: o que se testa aqui é
// o que as actions decidem com a resposta de cada um.
const signIn = vi.fn();
const signOut = vi.fn();
const auth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => auth(),
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: (...args: unknown[]) => signOut(...args),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a action lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

const cookiesGravados = vi.fn();
const cookiesExistentes = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      cookiesExistentes.has(nome) ? { name: nome, value: cookiesExistentes.get(nome) } : undefined,
    set: (...args: unknown[]) => cookiesGravados(...args),
  }),
}));

const fetch = vi.fn();

beforeEach(() => {
  signIn.mockReset();
  signIn.mockResolvedValue(undefined);
  signOut.mockReset();
  redirect.mockReset();
  auth.mockReset();
  auth.mockResolvedValue({ user: { email: "ana@telhacerta.com.br", empresaId: "e" } });
  cookiesGravados.mockReset();
  cookiesExistentes.clear();
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("entrar", () => {
  it("abre a sessão pelo NextAuth, que confere a senha no backend", async () => {
    expect(await entrar("ana@telhacerta.com.br", "s3nha-forte", true)).toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ana@telhacerta.com.br",
      senha: "s3nha-forte",
      redirect: false,
    });
  });

  it("diz só que e-mail ou senha não conferem quando o backend recusa", async () => {
    signIn.mockRejectedValue(new CredentialsSignin());

    expect(await entrar("ana@telhacerta.com.br", "errada", true)).toEqual({
      ok: false,
      erro: "credenciais_invalidas",
    });
  });

  it("pede para esperar quando o backend limita as entradas", async () => {
    signIn.mockRejectedValue(new MuitasEntradas());

    expect(await entrar("ana@telhacerta.com.br", "s3nha-forte", true)).toEqual({
      ok: false,
      erro: "muitas_tentativas",
    });
  });

  it("não culpa quem digitou quando o backend está fora do ar", async () => {
    signIn.mockRejectedValue(new Error("fetch failed"));

    expect(await entrar("ana@telhacerta.com.br", "s3nha-forte", true)).toEqual({
      ok: false,
      erro: "falha_sessao",
    });
  });

  it("sem 'manter sessão', regrava o cookie sem prazo para morrer com o navegador", async () => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");

    await entrar("ana@telhacerta.com.br", "s3nha-forte", false);

    expect(cookiesGravados).toHaveBeenCalledTimes(1);
    expect(cookiesGravados).toHaveBeenCalledWith("authjs.session-token", "jwt-da-sessao", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });
  });

  it("com 'manter sessão', deixa o cookie como o NextAuth gravou", async () => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");

    await entrar("ana@telhacerta.com.br", "s3nha-forte", true);

    expect(cookiesGravados).not.toHaveBeenCalled();
  });

  it("não mexe no cookie quando a entrada falhou", async () => {
    cookiesExistentes.set("authjs.session-token", "jwt-antigo");
    signIn.mockRejectedValue(new CredentialsSignin());

    await entrar("ana@telhacerta.com.br", "errada", false);

    expect(cookiesGravados).not.toHaveBeenCalled();
  });
});

describe("entrarNaDemonstracao", () => {
  function contaNoAmbiente() {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " demo@ledgr.com.br ");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "s3nha");
  }

  it("recusa quando a demonstração não foi ligada — mesmo chamada direto", async () => {
    contaNoAmbiente();
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "");

    expect(await entrarNaDemonstracao(true)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("recusa qualquer valor que não seja exatamente 1", async () => {
    contaNoAmbiente();
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "true");

    expect(await entrarNaDemonstracao(true)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("entra na conta de demonstração do ambiente, pelo mesmo login do backend", async () => {
    contaNoAmbiente();
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "1");

    expect(await entrarNaDemonstracao(true)).toBe(true);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "demo@ledgr.com.br",
      senha: "s3nha",
      redirect: false,
    });
  });

  it("recusa com a demonstração ligada se o ambiente não tem a conta", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "1");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");

    expect(await entrarNaDemonstracao(true)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("recusa quando o backend não aceita a conta de demonstração", async () => {
    contaNoAmbiente();
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "1");
    signIn.mockRejectedValue(new CredentialsSignin());

    expect(await entrarNaDemonstracao(true)).toBe(false);
  });
});

describe("cadastrar", () => {
  const DADOS = {
    nome: "Ana Souza",
    email: "ana@telhacerta.com.br",
    senha: "s3nha-forte",
    razaoSocial: "Telha Certa Ltda",
    cnpj: "12.345.678/0001-95",
  };

  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  it("cria a conta sem Bearer, com os nomes de campo do backend, e já entra com a mesma senha", async () => {
    respostaDoBackend(201, { id: "u", empresa_id: "e", nome: "Ana Souza", email: "ana@telhacerta.com.br" });

    expect(await cadastrar(DADOS)).toEqual({ ok: true, entrou: true });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/register");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({
      nome: "Ana Souza",
      email: "ana@telhacerta.com.br",
      senha: "s3nha-forte",
      razao_social: "Telha Certa Ltda",
      cnpj: "12.345.678/0001-95",
    });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ana@telhacerta.com.br",
      senha: "s3nha-forte",
      redirect: false,
    });
  });

  it("avisa que a conta foi criada mesmo quando a sessão não abre logo em seguida", async () => {
    respostaDoBackend(201, { id: "u", empresa_id: "e", nome: "Ana Souza", email: "ana@telhacerta.com.br" });
    signIn.mockRejectedValue(new MuitasEntradas());

    expect(await cadastrar(DADOS)).toEqual({ ok: true, entrou: false });
  });

  it("separa e-mail já cadastrado de CNPJ já cadastrado", async () => {
    respostaDoBackend(409, { detail: "E-mail já cadastrado." });
    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "email_cadastrado" });

    respostaDoBackend(409, { detail: "CNPJ já cadastrado." });
    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "cnpj_cadastrado" });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("trata o 409 ambíguo, de dois cadastros ao mesmo tempo, como falha a tentar de novo", async () => {
    respostaDoBackend(409, { detail: "E-mail ou CNPJ já cadastrado." });

    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "falha" });
  });

  it("devolve os campos recusados no 422 com os nomes do formulário", async () => {
    respostaDoBackend(422, {
      detail: [
        { loc: ["body", "razao_social"], msg: "Value error, não pode ser vazio" },
        { loc: ["body", "cnpj"], msg: "Value error, CNPJ inválido" },
      ],
    });

    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "invalido", campos: ["razaoSocial", "cnpj"] });
  });

  it("pede para esperar no limite de cadastros por minuto", async () => {
    respostaDoBackend(429, { detail: "Rate limit exceeded" });

    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "muitas_tentativas" });
  });

  it("não culpa quem digitou quando o backend está fora do ar", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "falha" });

    respostaDoBackend(500, { detail: "Internal Server Error" });
    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "falha" });
  });
});

describe("a conta de quem está logado", () => {
  function respostaDoBackend(status: number, corpo?: object) {
    fetch.mockResolvedValue(corpo ? Response.json(corpo, { status }) : new Response(null, { status }));
  }

  /** O que foi para o backend: rota, método, corpo e se levou o Bearer da sessão. */
  function chamada() {
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    return {
      url,
      metodo: init.method,
      corpo: JSON.parse(String(init.body)),
      bearer: new Headers(init.headers).get("Authorization"),
    };
  }

  beforeEach(() => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");
  });

  it("troca a senha com a atual e refaz a sessão com a nova, sem 'manter sessão'", async () => {
    respostaDoBackend(204);

    expect(await trocarSenha("s3nha-velha", "s3nha-nova")).toEqual({ ok: true });

    expect(chamada()).toEqual({
      url: "http://localhost:8000/me/senha",
      metodo: "POST",
      corpo: { senha_atual: "s3nha-velha", senha_nova: "s3nha-nova" },
      bearer: "Bearer jwt-da-sessao",
    });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ana@telhacerta.com.br",
      senha: "s3nha-nova",
      redirect: false,
    });
    expect(cookiesGravados).toHaveBeenCalledWith("authjs.session-token", "jwt-da-sessao", expect.any(Object));
  });

  it("troca o e-mail já normalizado e entra com o novo", async () => {
    respostaDoBackend(204);

    expect(await trocarEmail("  Ana@Nova.com.BR ", "s3nha")).toEqual({ ok: true });

    expect(chamada().corpo).toEqual({ email_novo: "ana@nova.com.br", senha_atual: "s3nha" });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ana@nova.com.br",
      senha: "s3nha",
      redirect: false,
    });
  });

  it("mostra o texto do backend para senha atual errada e e-mail já usado, sem refazer a sessão", async () => {
    respostaDoBackend(400, { detail: "Senha atual incorreta." });
    expect(await trocarSenha("errada", "s3nha-nova")).toEqual({ ok: false, erro: "Senha atual incorreta." });

    respostaDoBackend(409, { detail: "E-mail já cadastrado." });
    expect(await trocarEmail("outra@telhacerta.com.br", "s3nha")).toEqual({
      ok: false,
      erro: "E-mail já cadastrado.",
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("diz que ainda não dá enquanto a rota não existe no backend", async () => {
    respostaDoBackend(404, { detail: "Not Found" });

    expect(await excluirConta("s3nha")).toEqual({
      ok: false,
      erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função.",
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("exclui com a senha atual e sai para o site", async () => {
    respostaDoBackend(204);

    await excluirConta("s3nha");

    expect(chamada()).toMatchObject({ url: "http://localhost:8000/me", metodo: "DELETE", corpo: { senha_atual: "s3nha" } });
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("recusa mexer na conta de demonstração sem nem chamar o backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " Ana@TelhaCerta.com.br ");

    expect(await excluirConta("s3nha")).toEqual({
      ok: false,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manda para o login quando a sessão acabou", async () => {
    respostaDoBackend(401, { detail: "Token inválido." });

    await expect(trocarSenha("s3nha", "s3nha-nova")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

describe("razaoSocialDaEmpresa", () => {
  beforeEach(() => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");
  });

  it("lê a razão social de GET /me", async () => {
    fetch.mockResolvedValue(
      Response.json({ id: "u", empresa_id: "e", nome: "Ana", email: "a@b.com", razao_social: "Telha Certa Ltda" }),
    );

    expect(await razaoSocialDaEmpresa()).toBe("Telha Certa Ltda");
    expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/me");
  });

  it("devolve vazio enquanto a rota não existe, em vez de inventar um nome", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Not Found" }, { status: 404 }));

    expect(await razaoSocialDaEmpresa()).toBe("");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CredentialsSignin } from "next-auth";
import { MuitasEntradas } from "@/lib/login";
import {
  aceitarConvite,
  aceitarConviteComGoogle,
  cadastrar,
  cadastrarComGoogle,
  entrar,
  entrarComGoogle,
  entrarNaDemonstracao,
  escolherPlano,
  desativarConta,
  pedirRecuperacaoSenha,
  consultarConvite,
  contaDaSessao,
  conviteDoCookie,
  redefinirSenha,
  sair,
  sairParaAceitarConvite,
  salvarPreferencias,
  trocarEmail,
  confirmarEmail,
  trocarSenha,
  verificarCadastro,
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
const cookiesApagados = vi.fn();
const cookiesExistentes = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      cookiesExistentes.has(nome) ? { name: nome, value: cookiesExistentes.get(nome) } : undefined,
    set: (...args: unknown[]) => cookiesGravados(...args),
    delete: (...args: unknown[]) => cookiesApagados(...args),
  }),
}));

// quem está na sessão, pelo token que vai no Bearer (o jose não roda no jsdom; testado em lib/backend.test.ts)
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  emailDaSessao: () => emailDaSessao(),
}));

const fetch = vi.fn();

beforeEach(() => {
  emailDaSessao.mockReset();
  emailDaSessao.mockResolvedValue("ana@telhacerta.com.br");
  signIn.mockReset();
  signIn.mockResolvedValue(undefined);
  signOut.mockReset();
  redirect.mockReset();
  auth.mockReset();
  auth.mockResolvedValue({ user: { email: "ana@telhacerta.com.br", contaId: "e" } });
  cookiesGravados.mockReset();
  cookiesApagados.mockReset();
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

  // backend #119: a recusa da Receita vem no mesmo 422 do formato, com loc no cnpj; só a msg a separa
  it("separa os dois 422 da Receita da recusa de formato do CNPJ", async () => {
    respostaDoBackend(422, {
      detail: [{ type: "value_error", loc: ["body", "cnpj"], msg: "CNPJ não encontrado na Receita Federal." }],
    });
    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "cnpj_nao_encontrado" });

    respostaDoBackend(422, {
      detail: [{ type: "value_error", loc: ["body", "cnpj"], msg: "CNPJ não está ativo na Receita Federal." }],
    });
    expect(await cadastrar(DADOS)).toEqual({ ok: false, erro: "cnpj_inativo" });
    expect(signIn).not.toHaveBeenCalled();
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

describe("entrarComGoogle", () => {
  it("esquece um convite pelo Google que ficou pela metade, para o login não virar aceite", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    cookiesExistentes.set("ledgr-convite-google", "tok");

    await entrarComGoogle();

    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-convite-google");
    expect(cookiesApagados.mock.invocationCallOrder[0]).toBeLessThan(signIn.mock.invocationCallOrder[0]);
  });

  it("leva ao Google pelo NextAuth, voltando à visão geral", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    await entrarComGoogle();
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/visao-geral" });
  });

  it("volta ao consentimento de um pedido de conexão, e um destino de fora vira a visão geral", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    await entrarComGoogle("/autorizar-conexao?pedido=Ab_12");
    expect(signIn).toHaveBeenLastCalledWith("google", { redirectTo: "/autorizar-conexao?pedido=Ab_12" });

    await entrarComGoogle("https://outro.site");
    expect(signIn).toHaveBeenLastCalledWith("google", { redirectTo: "/visao-geral" });
  });

  it("não chama o NextAuth quando o servidor não tem o provider", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "");
    expect(await entrarComGoogle()).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("cadastrarComGoogle", () => {
  const DADOS = { nome: "Ana Souza", razaoSocial: "Telha Certa Ltda", cnpj: "12.345.678/0001-95" };

  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  beforeEach(() => {
    cookiesExistentes.set("ledgr-cadastro-google", "id-token-do-google");
  });

  it("cria a conta com o id_token do cookie, sem e-mail nem senha, e abre a sessão", async () => {
    respostaDoBackend(201, { id: "u", empresa_id: "e", nome: "Ana Souza", email: "ana@gmail.com", auth_time: 1 });

    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: true, entrou: true });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/register/google");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({
      id_token: "id-token-do-google",
      razao_social: "Telha Certa Ltda",
      cnpj: "12.345.678/0001-95",
      nome: "Ana Souza",
    });
    expect(signIn).toHaveBeenCalledWith("google-cadastro", { redirect: false });
  });

  it("sem nome, deixa o backend usar o da conta Google", async () => {
    respostaDoBackend(201, { id: "u", empresa_id: "e", nome: "Ana", email: "ana@gmail.com" });
    await cadastrarComGoogle({ ...DADOS, nome: "" });
    expect(JSON.parse(String((fetch.mock.calls[0] as [string, RequestInit])[1].body))).not.toHaveProperty("nome");
  });

  it("conta criada com a sessão que não abriu: falta só entrar", async () => {
    respostaDoBackend(201, { id: "u", empresa_id: "e", nome: "Ana", email: "ana@gmail.com" });
    signIn.mockRejectedValue(new CredentialsSignin());
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: true, entrou: false });
  });

  it("pede o Google de novo sem o cookie ou com o id_token vencido", async () => {
    respostaDoBackend(401, { detail: "Não foi possível confirmar a conta Google." });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "google_expirado" });
    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-cadastro-google");

    cookiesExistentes.clear();
    fetch.mockReset();
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "google_expirado" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("separa os três 409 do cadastro pelo Google", async () => {
    respostaDoBackend(409, { detail: "E-mail já cadastrado." });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "email_cadastrado" });
    respostaDoBackend(409, { detail: "CNPJ já cadastrado." });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "cnpj_cadastrado" });
    respostaDoBackend(409, { detail: "Já existe uma conta no Ledgr para esta conta Google." });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "google_ja_cadastrado" });
  });

  it("trata os 422 como o /register, inclusive os da Receita (#119)", async () => {
    respostaDoBackend(422, {
      detail: [{ loc: ["body", "cnpj"], msg: "CNPJ não encontrado na Receita Federal." }],
    });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "cnpj_nao_encontrado" });

    respostaDoBackend(422, { detail: [{ loc: ["body", "nome"], msg: "Field required" }] });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "invalido", campos: ["nome"] });
  });

  it("separa o Google desligado, o limite por minuto e o backend fora do ar", async () => {
    respostaDoBackend(503, { detail: "Login pelo Google indisponível." });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "google_indisponivel" });
    respostaDoBackend(429, { detail: "Rate limit exceeded" });
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "muitas_tentativas" });
    fetch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await cadastrarComGoogle(DADOS)).toEqual({ ok: false, erro: "falha" });
  });
});

describe("verificarCadastro", () => {
  const DADOS = { email: "ana@telhacerta.com.br", cnpj: "12.345.678/0001-95" };

  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  it("confere e-mail e CNPJ juntos, sem Bearer e sem criar nada", async () => {
    respostaDoBackend(200, { email_disponivel: true, cnpj_disponivel: true });

    expect(await verificarCadastro(DADOS)).toEqual({
      ok: true,
      emailDisponivel: true,
      cnpjDisponivel: true,
      cnpjSituacao: "nao_verificado",
      razaoSocialReceita: null,
    });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/register/verificar");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual(DADOS);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("diz qual dos dois já está em uso", async () => {
    respostaDoBackend(200, { email_disponivel: false, cnpj_disponivel: true });
    expect(await verificarCadastro(DADOS)).toMatchObject({ ok: true, emailDisponivel: false, cnpjDisponivel: true });

    respostaDoBackend(200, { email_disponivel: true, cnpj_disponivel: false });
    expect(await verificarCadastro(DADOS)).toMatchObject({ ok: true, emailDisponivel: true, cnpjDisponivel: false });
  });

  it("traz a situação do CNPJ na Receita e a razão social de lá (backend #119)", async () => {
    respostaDoBackend(200, {
      email_disponivel: true,
      cnpj_disponivel: true,
      cnpj_situacao: "ativa",
      razao_social: "  TELHA CERTA COMERCIO LTDA ",
    });
    expect(await verificarCadastro(DADOS)).toMatchObject({
      cnpjSituacao: "ativa",
      razaoSocialReceita: "TELHA CERTA COMERCIO LTDA",
    });

    respostaDoBackend(200, {
      email_disponivel: true,
      cnpj_disponivel: true,
      cnpj_situacao: "nao_encontrado",
      razao_social: null,
    });
    expect(await verificarCadastro(DADOS)).toMatchObject({ cnpjSituacao: "nao_encontrado", razaoSocialReceita: null });
  });

  // um valor que esta tela não conhece não pode bloquear o cadastro
  it("trata situação desconhecida como não verificada", async () => {
    respostaDoBackend(200, { email_disponivel: true, cnpj_disponivel: true, cnpj_situacao: "suspensa", razao_social: "" });
    expect(await verificarCadastro(DADOS)).toMatchObject({ cnpjSituacao: "nao_verificado", razaoSocialReceita: null });
  });

  it("devolve o campo recusado no 422 com o nome do formulário", async () => {
    respostaDoBackend(422, { detail: [{ loc: ["body", "cnpj"], msg: "Value error, CNPJ inválido" }] });

    expect(await verificarCadastro(DADOS)).toEqual({ ok: false, erro: "invalido", campos: ["cnpj"] });
  });

  // a conferência é um adianto: sem ela o cadastro segue, e o /register confere tudo no fim
  it("fica indisponível no limite por minuto, sem a rota ou com o backend fora do ar", async () => {
    respostaDoBackend(429, { detail: "Rate limit exceeded" });
    expect(await verificarCadastro(DADOS)).toEqual({ ok: false, erro: "indisponivel" });

    respostaDoBackend(404, { detail: "Not Found" });
    expect(await verificarCadastro(DADOS)).toEqual({ ok: false, erro: "indisponivel" });

    fetch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await verificarCadastro(DADOS)).toEqual({ ok: false, erro: "indisponivel" });
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

  it("pede a troca do e-mail já normalizado e mantém a sessão: só muda quando o link for aberto", async () => {
    respostaDoBackend(202, { email_novo: "ana@nova.com.br", expira_em: "2026-10-22T20:00:00Z" });

    expect(await trocarEmail("  Ana@Nova.com.BR ", "s3nha")).toEqual({ ok: true });

    expect(chamada()).toMatchObject({
      url: "http://localhost:8000/me/email",
      metodo: "POST",
      corpo: { email_novo: "ana@nova.com.br", senha_atual: "s3nha" },
    });
    expect(signIn).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("mostra o texto do backend para e-mail igual, limite por hora e e-mail desligado", async () => {
    respostaDoBackend(422, { detail: "O e-mail novo é igual ao atual." });
    expect(await trocarEmail("ana@telhacerta.com.br", "s3nha")).toEqual({
      ok: false,
      erro: "O e-mail novo é igual ao atual.",
    });

    const porHora = "Você já pediu a troca de e-mail várias vezes na última hora. Tente mais tarde.";
    fetch.mockResolvedValue(Response.json({ detail: porHora }, { status: 429, headers: { "Retry-After": "1800" } }));
    expect(await trocarEmail("ana@nova.com.br", "s3nha")).toEqual({ ok: false, erro: porHora });

    respostaDoBackend(429, { detail: "Rate limit exceeded" });
    expect(await trocarEmail("ana@nova.com.br", "s3nha")).toEqual({
      ok: false,
      erro: "Muitas tentativas. Espere um minuto e tente de novo.",
    });

    respostaDoBackend(503, { detail: "Troca de e-mail indisponível no momento." });
    expect(await trocarEmail("ana@nova.com.br", "s3nha")).toEqual({
      ok: false,
      erro: "Indisponível no momento. Tente de novo mais tarde.",
    });
  });

  it("se a sessão não volta depois da troca, sai e manda ao login", async () => {
    // a senha já mudou no backend: deixar a sessão antiga aberta seria pior que pedir o login de novo
    respostaDoBackend(204);
    signIn.mockRejectedValue(new Error("NEXTAUTH_SECRET"));

    await trocarSenha("s3nha-velha", "s3nha-nova");

    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
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

  it("desativa com a senha atual e sai para o site", async () => {
    respostaDoBackend(204);

    await desativarConta("s3nha");

    expect(chamada()).toMatchObject({ url: "http://localhost:8000/me", metodo: "DELETE", corpo: { senha_atual: "s3nha" } });
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("na conta só do Google, desativa sem mandar senha", async () => {
    respostaDoBackend(204);

    await desativarConta(null);

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["http://localhost:8000/me", "DELETE", undefined]);
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("mostra o que o backend pede: senha certa, login recente, ou a administração transferida antes", async () => {
    for (const [status, texto] of [
      [400, "Senha atual incorreta."],
      [409, "Entre de novo com o Google para confirmar a desativação."],
      [409, "Transfira o papel de admin antes de desativar a sua conta."],
    ] as const) {
      respostaDoBackend(status, { detail: texto });
      expect(await desativarConta(status === 400 ? "errada" : null)).toEqual({ ok: false, erro: texto });
    }
    expect(signOut).not.toHaveBeenCalled();
  });

  it("recusa mexer na conta de demonstração sem nem chamar o backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " Ana@TelhaCerta.com.br ");

    expect(await desativarConta("s3nha")).toEqual({
      ok: false,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reconhece a demonstração pelo token que vai ao backend, mesmo com o auth() vendo outra conta", async () => {
    // com dois cookies de sessão no navegador, o auth() e o Bearer podiam ler contas diferentes
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@telhacerta.com.br");
    auth.mockResolvedValue({ user: { email: "outra@empresa.com.br", contaId: "e2" } });

    expect(await trocarSenha("s3nha", "s3nha-nova")).toEqual({
      ok: false,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sem token válido, manda para o login sem chamar o backend", async () => {
    emailDaSessao.mockResolvedValue(null);

    await expect(desativarConta("s3nha")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manda para o login quando a sessão acabou", async () => {
    respostaDoBackend(401, { detail: "Token inválido." });

    await expect(trocarSenha("s3nha", "s3nha-nova")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

describe("contaDaSessao", () => {
  // o corpo de GET /me (backend #81), sem `papel` nem `administrador` (backend antes da #69)
  const EU = {
    id: "u",
    empresa_id: "e",
    nome: "Ana",
    email: "a@b.com",
    razao_social: " Telha Certa Ltda ",
    cnpj: "12345678000195",
    metodos_login: ["senha", "google"],
  };

  beforeEach(() => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");
  });

  it("lê a razão social de GET /me, e que a conta tem senha para trocar", async () => {
    fetch.mockResolvedValue(Response.json(EU));

    expect(await contaDaSessao()).toEqual({ empresa: "Telha Certa Ltda", nome: "Ana", temSenha: true, papel: "admin", empresas: [], preferencias: null, assinatura: null, limites: null, guardaArquivoOriginal: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("http://localhost:8000/me");
  });

  it("lê se a conta guarda o original de cada extrato (backend #139)", async () => {
    fetch.mockResolvedValue(Response.json({ ...EU, guarda_arquivo_original: true }));
    expect((await contaDaSessao()).guardaArquivoOriginal).toBe(true);
  });

  it("lê os limites do plano (backend #133); sem o campo, limites é null", async () => {
    fetch.mockResolvedValue(
      Response.json({ ...EU, limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: { usados: 1, maximo: null } } }),
    );

    expect((await contaDaSessao()).limites).toEqual({ empresas: { usadas: 2, maximo: 3 }, usuarios: { usadas: 1, maximo: null } });

    fetch.mockResolvedValue(Response.json(EU));
    expect((await contaDaSessao()).limites).toBeNull();
  });

  it("conta que só entra pelo Google não tem senha para trocar", async () => {
    // para ela, POST /me/senha responde 409
    fetch.mockResolvedValue(Response.json({ ...EU, metodos_login: ["google"] }));

    expect(await contaDaSessao()).toEqual({ empresa: "Telha Certa Ltda", nome: "Ana", temSenha: false, papel: "admin", empresas: [], preferencias: null, assinatura: null, limites: null, guardaArquivoOriginal: false });
  });

  it("sem resposta, esconde a empresa em vez de inventar um nome e deixa a troca de senha à mostra", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Not Found" }, { status: 404 }));

    expect(await contaDaSessao()).toEqual({ empresa: "", temSenha: true, papel: "admin", empresas: [], preferencias: null, assinatura: null, limites: null, indisponivel: true });
  });

  it("lê as empresas da conta do /me, na ordem em que o backend manda (#133)", async () => {
    fetch.mockResolvedValue(
      Response.json({
        ...EU,
        empresas: [
          { id: "e1", razao_social: " Padaria Ltda ", cnpj: "11222333000181" },
          { id: "e2", razao_social: "Mercado Ltda", cnpj: "11444777000161" },
        ],
      }),
    );

    expect((await contaDaSessao()).empresas).toEqual([
      { id: "e1", razaoSocial: "Padaria Ltda", cnpj: "11222333000181" },
      { id: "e2", razaoSocial: "Mercado Ltda", cnpj: "11444777000161" },
    ]);
  });

  it("sem empresas no /me (backend anterior ao #133), a lista é vazia; e ignora o item que não tem id", async () => {
    fetch.mockResolvedValue(Response.json(EU));
    expect((await contaDaSessao()).empresas).toEqual([]);

    fetch.mockResolvedValue(Response.json({ ...EU, empresas: [{ razao_social: "Sem id" }, { id: "e1", razao_social: "Ok", cnpj: "1" }] }));
    expect((await contaDaSessao()).empresas).toEqual([{ id: "e1", razaoSocial: "Ok", cnpj: "1" }]);
  });

  it("lê o papel da pessoa, que o backend manda em papel (#133)", async () => {
    fetch.mockResolvedValue(Response.json({ ...EU, papel: "gestor", administrador: false }));

    expect((await contaDaSessao()).papel).toBe("gestor");
  });

  it("o papel manda mesmo quando o administrador, obsoleto, diz outra coisa", async () => {
    fetch.mockResolvedValue(Response.json({ ...EU, papel: "analista", administrador: true }));

    expect((await contaDaSessao()).papel).toBe("analista");
  });

  it("sem papel, lê o administrador do backend anterior ao #133", async () => {
    fetch.mockResolvedValue(Response.json({ ...EU, administrador: false }));

    expect((await contaDaSessao()).papel).toBe("analista");
  });

  it("sem papel nem administrador, trata como admin, como na conta única", async () => {
    fetch.mockResolvedValue(Response.json(EU));

    expect((await contaDaSessao()).papel).toBe("admin");
  });

  it("lê o plano e o teste de 14 dias", async () => {
    fetch.mockResolvedValue(Response.json({ ...EU, situacao: "teste", plano: "padrao", teste_termina_em: "2026-10-29" }));

    expect((await contaDaSessao()).assinatura).toEqual({ situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29" });
  });

  it("lê as preferências do primeiro uso, só com telas conhecidas", async () => {
    fetch.mockResolvedValue(
      Response.json({ ...EU, preferencias: { tutoriais_dispensados: ["extratos", "nao-existe"], roteiro_dispensado: true } }),
    );

    expect((await contaDaSessao()).preferencias).toEqual({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
  });
});

describe("salvarPreferencias", () => {
  beforeEach(() => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");
  });

  it("manda pelo PATCH /me/preferencias e diz que deu certo", async () => {
    fetch.mockResolvedValue(Response.json({}));

    await expect(salvarPreferencias({ tutoriaisDispensados: ["historico"], roteiroDispensado: false })).resolves.toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/me/preferencias");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ tutoriais_dispensados: ["historico"], roteiro_dispensado: false });
  });

  it("na conta de demonstração, não grava na conta: um visitante não esconde o tutorial dos outros", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@telhacerta.com.br");

    await expect(salvarPreferencias({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true })).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sem a rota no backend, devolve falso sem lançar", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Not Found" }, { status: 404 }));

    await expect(salvarPreferencias({ tutoriaisDispensados: [], roteiroDispensado: true })).resolves.toBe(false);
  });
});

describe("pedirRecuperacaoSenha", () => {
  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  it("pede o link sem Bearer, com o e-mail limpo", async () => {
    respostaDoBackend(202, { mensagem: "Se o e-mail estiver cadastrado, enviaremos um link." });

    expect(await pedirRecuperacaoSenha("  Ana@TelhaCerta.com.br ")).toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/senha/recuperar");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ email: "ana@telhacerta.com.br" });
  });

  it("avisa quando o envio de e-mail está desligado no servidor", async () => {
    respostaDoBackend(503, { detail: "Recuperação de senha indisponível no momento." });

    expect(await pedirRecuperacaoSenha("ana@telhacerta.com.br")).toEqual({ ok: false, erro: "indisponivel" });
  });

  it("pede para esperar quando o backend limita os pedidos", async () => {
    respostaDoBackend(429, { error: "Rate limit exceeded" });

    expect(await pedirRecuperacaoSenha("ana@telhacerta.com.br")).toEqual({ ok: false, erro: "muitas_tentativas" });
  });

  it("não culpa quem digitou quando o backend está fora do ar", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));

    expect(await pedirRecuperacaoSenha("ana@telhacerta.com.br")).toEqual({ ok: false, erro: "falha" });
  });
});

describe("redefinirSenha", () => {
  function respostaDoBackend(status: number, corpo?: object) {
    fetch.mockResolvedValue(corpo ? Response.json(corpo, { status }) : new Response(null, { status }));
  }

  it("manda o token do link e a senha nova sem Bearer", async () => {
    respostaDoBackend(204);

    expect(await redefinirSenha("token-do-link", "s3nha-nova")).toEqual({ ok: true });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/senha/redefinir");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ token: "token-do-link", senha_nova: "s3nha-nova" });
  });

  it("diz que o link não vale mais quando o backend recusa o token", async () => {
    respostaDoBackend(400, { detail: "Link inválido ou expirado. Peça um novo." });

    expect(await redefinirSenha("token-velho", "s3nha-nova")).toEqual({ ok: false, erro: "link_invalido" });
  });

  it("aponta a senha quando ela não passa na regra do backend", async () => {
    respostaDoBackend(422, { detail: [{ loc: ["body", "senha_nova"], msg: "curta" }] });

    expect(await redefinirSenha("token", "curta")).toEqual({ ok: false, erro: "senha_invalida" });
  });

  it("trata token malformado como link inválido", async () => {
    respostaDoBackend(422, { detail: [{ loc: ["body", "token"], msg: "vazio" }] });

    expect(await redefinirSenha("", "s3nha-nova")).toEqual({ ok: false, erro: "link_invalido" });
  });

  it("pede para esperar quando o backend limita as tentativas", async () => {
    respostaDoBackend(429, { error: "Rate limit exceeded" });

    expect(await redefinirSenha("token", "s3nha-nova")).toEqual({ ok: false, erro: "muitas_tentativas" });
  });

  it("não culpa quem digitou quando o backend está fora do ar", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));

    expect(await redefinirSenha("token", "s3nha-nova")).toEqual({ ok: false, erro: "falha" });
  });
});

describe("confirmarEmail", () => {
  function respostaDoBackend(status: number, corpo: object) {
    fetch.mockResolvedValue(Response.json(corpo, { status }));
  }

  it("manda o token do link sem Bearer e devolve o e-mail novo", async () => {
    respostaDoBackend(200, { email: "ana@nova.com.br" });

    expect(await confirmarEmail("token-do-link")).toEqual({ ok: true, email: "ana@nova.com.br" });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/me/email/confirmar");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ token: "token-do-link" });
  });

  it("separa link inválido, e-mail tomado, limite e falha", async () => {
    respostaDoBackend(400, { detail: "Link inválido ou expirado." });
    expect(await confirmarEmail("velho")).toEqual({ ok: false, erro: "link_invalido" });

    respostaDoBackend(409, { detail: "E-mail já cadastrado." });
    expect(await confirmarEmail("token")).toEqual({ ok: false, erro: "email_em_uso" });

    respostaDoBackend(429, { error: "Rate limit exceeded" });
    expect(await confirmarEmail("token")).toEqual({ ok: false, erro: "muitas_tentativas" });

    fetch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await confirmarEmail("token")).toEqual({ ok: false, erro: "falha" });
  });
});

describe("escolherPlano", () => {
  beforeEach(() => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");
  });

  it("começa o teste pelo POST /empresa/plano", async () => {
    fetch.mockResolvedValue(Response.json({}));

    await expect(escolherPlano("padrao")).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:8000/empresa/plano");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ plano: "padrao" });
  });

  it("sem a rota no backend, diz que ainda não está disponível", async () => {
    fetch.mockResolvedValue(Response.json({ detail: "Not Found" }, { status: 404 }));

    await expect(escolherPlano("essencial")).resolves.toEqual({
      ok: false,
      erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função.",
    });
  });

  it("a conta de demonstração não escolhe plano", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@telhacerta.com.br");

    await expect(escolherPlano("padrao")).resolves.toEqual({ ok: false, erro: "A conta de demonstração não pode ser alterada." });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recusa um plano que não existe sem chamar o backend", async () => {
    await expect(escolherPlano("ouro" as "padrao")).resolves.toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("consultarConvite", () => {
  it("consulta o convite pelo corpo, sem sessão", async () => {
    fetch.mockResolvedValue(
      Response.json({ email: "ana@x.com", razao_social: "Padaria Ltda", expira_em: "2026-10-23T12:00:00Z" }),
    );

    expect(await consultarConvite("tok")).toEqual({
      ok: true,
      convite: { email: "ana@x.com", razaoSocial: "Padaria Ltda", valeAte: "23/10/2026" },
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/convites/consultar");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ token: "tok" });
  });

  it.each([
    [400, "convite_invalido"],
    [422, "convite_invalido"],
    [429, "muitas_tentativas"],
    [500, "falha"],
  ])("com %i responde %s", async (status, erro) => {
    fetch.mockResolvedValue(Response.json({ detail: "x" }, { status }));

    expect(await consultarConvite("tok")).toEqual({ ok: false, erro });
  });

  it("sem conseguir falar com o servidor, é falha", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));

    expect(await consultarConvite("tok")).toEqual({ ok: false, erro: "falha" });
  });
});

describe("aceitarConvite", () => {
  it("cria a conta pelo convite e já entra com o e-mail dele", async () => {
    fetch.mockResolvedValue(Response.json({ id: "u", empresa_id: "e", nome: "Ana", email: "ana@x.com" }, { status: 201 }));

    expect(await aceitarConvite("tok", "ana@x.com", "Ana", "senha-boa-1")).toEqual({ ok: true, entrou: true });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/convites/aceitar");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(init.body))).toEqual({ token: "tok", nome: "Ana", senha: "senha-boa-1" });
    expect(signIn).toHaveBeenCalledWith("credentials", { email: "ana@x.com", senha: "senha-boa-1", redirect: false });
  });

  it("conta criada com a sessão que não abriu: falta só entrar", async () => {
    fetch.mockResolvedValue(Response.json({ id: "u", empresa_id: "e", nome: "Ana", email: "ana@x.com" }, { status: 201 }));
    signIn.mockRejectedValue(new Error("NEXTAUTH_SECRET"));

    expect(await aceitarConvite("tok", "ana@x.com", "Ana", "senha-boa-1")).toEqual({ ok: true, entrou: false });
  });

  it("entra com o e-mail que o backend devolveu, não com o que veio do navegador", async () => {
    fetch.mockResolvedValue(Response.json({ id: "u", empresa_id: "e", nome: "Ana", email: "ana@convite.com" }, { status: 201 }));

    await aceitarConvite("tok", "outra@x.com", "Ana", "senha-boa-1");

    expect(signIn).toHaveBeenCalledWith("credentials", { email: "ana@convite.com", senha: "senha-boa-1", redirect: false });
  });

  it.each([
    [400, { detail: "Convite inválido ou expirado. Peça um novo convite." }, "convite_invalido"],
    [409, { detail: "E-mail já cadastrado." }, "email_cadastrado"],
    [422, { detail: [{ loc: ["body", "senha"], msg: "curta" }] }, "senha_invalida"],
    [429, { error: "Rate limit exceeded" }, "muitas_tentativas"],
    [500, { detail: "x" }, "falha"],
  ])("com %i responde %s, sem tentar entrar", async (status, corpo, erro) => {
    fetch.mockResolvedValue(Response.json(corpo, { status }));

    expect(await aceitarConvite("tok", "ana@x.com", "Ana", "senha-boa-1")).toEqual({ ok: false, erro });
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("sair", () => {
  it("apaga os cookies do Google junto com a sessão", async () => {
    await sair();

    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-cadastro-google");
    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-convite-google");
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});

describe("sairParaAceitarConvite", () => {
  it("encerra a sessão sem sair da página do convite", async () => {
    await sairParaAceitarConvite();

    expect(signOut).toHaveBeenCalledWith({ redirect: false });
  });
});

describe("aceitarConviteComGoogle", () => {
  it("guarda o token do convite num cookie httpOnly de 1 hora e leva ao Google", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");

    await aceitarConviteComGoogle("tok");

    expect(cookiesGravados).toHaveBeenCalledWith(
      "ledgr-convite-google",
      "tok",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 3600 }),
    );
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/visao-geral" });
  });

  it("sem token, tenta de novo com o cookie que já existe", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    cookiesExistentes.set("ledgr-convite-google", "tok");

    await aceitarConviteComGoogle("");

    expect(cookiesGravados).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/visao-geral" });
  });

  it("sem token e sem cookie, ou sem o provider, não vai ao Google", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client-id");
    expect(await aceitarConviteComGoogle("")).toBe(false);

    vi.stubEnv("AUTH_GOOGLE_ID", "");
    expect(await aceitarConviteComGoogle("tok")).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
    expect(cookiesGravados).not.toHaveBeenCalled();
  });
});

describe("conviteDoCookie", () => {
  it("sem cookie não chama o backend", async () => {
    expect(await conviteDoCookie()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("consulta o convite do cookie", async () => {
    cookiesExistentes.set("ledgr-convite-google", "tok");
    fetch.mockResolvedValue(
      Response.json({ email: "ana@x.com", razao_social: "Padaria Ltda", expira_em: "2026-10-23T12:00:00Z" }),
    );

    expect(await conviteDoCookie()).toEqual({ email: "ana@x.com", razaoSocial: "Padaria Ltda", valeAte: "23/10/2026" });
    expect(JSON.parse(String((fetch.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ token: "tok" });
  });

  it("convite inválido devolve null sem apagar o cookie, porque roda no render da página", async () => {
    cookiesExistentes.set("ledgr-convite-google", "tok");
    fetch.mockResolvedValue(Response.json({ detail: "x" }, { status: 400 }));

    expect(await conviteDoCookie()).toBeNull();
    expect(cookiesApagados).not.toHaveBeenCalled();
  });
});

describe("aceitarConvite depois de uma recusa do Google", () => {
  it("sem token na página, usa o do cookie do convite", async () => {
    cookiesExistentes.set("ledgr-convite-google", "tok-do-cookie");
    fetch.mockResolvedValue(Response.json({ id: "u", empresa_id: "e", nome: "Ana", email: "ana@x.com" }, { status: 201 }));

    expect(await aceitarConvite("", "ana@x.com", "Ana", "senha-boa-1")).toEqual({ ok: true, entrou: true });
    expect(JSON.parse(String((fetch.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      token: "tok-do-cookie",
      nome: "Ana",
      senha: "senha-boa-1",
    });
    expect(cookiesApagados).toHaveBeenCalledWith("ledgr-convite-google");
  });

  it("sem token e sem cookie, é convite inválido sem chamar o backend", async () => {
    expect(await aceitarConvite("", "ana@x.com", "Ana", "senha-boa-1")).toEqual({ ok: false, erro: "convite_invalido" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entrar, entrarNaDemonstracao } from "./acoes";

// NextAuth e cookies são a fronteira externa: o que se testa aqui é o que as
// actions decidem antes de abrir a sessão — a conta de teste roda de verdade.
const signIn = vi.fn();
vi.mock("@/auth", () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signOut: vi.fn(),
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

function contaNoAmbiente() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.com.br");
  vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "s3nha");
}

describe("entrar", () => {
  beforeEach(() => {
    signIn.mockReset();
    signIn.mockResolvedValue(undefined);
    cookiesGravados.mockReset();
    cookiesExistentes.clear();
    contaNoAmbiente();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("abre a sessão quando a conta confere", async () => {
    expect(await entrar("demo@ledgr.com.br", "s3nha", true)).toEqual({ ok: true });
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "demo@ledgr.com.br",
      senha: "s3nha",
      redirect: false,
    });
  });

  it("diz que a senha está errada sem abrir sessão", async () => {
    expect(await entrar("demo@ledgr.com.br", "errada", true)).toEqual({
      ok: false,
      erro: "senha_incorreta",
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("diz que a conta não existe sem abrir sessão", async () => {
    expect(await entrar("outra@empresa.com.br", "s3nha", true)).toEqual({
      ok: false,
      erro: "conta_nao_encontrada",
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("não aceita a senha do repositório em produção sem conta configurada", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");

    expect(await entrar("financeiro@telhacerta.com.br", "ledgr2026", true)).toEqual({
      ok: false,
      erro: "falha_sessao",
    });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("devolve falha de sessão quando o NextAuth recusa", async () => {
    signIn.mockRejectedValue(new Error("CredentialsSignin"));

    expect(await entrar("demo@ledgr.com.br", "s3nha", true)).toEqual({
      ok: false,
      erro: "falha_sessao",
    });
  });

  it("sem 'manter sessão', regrava o cookie sem prazo para morrer com o navegador", async () => {
    cookiesExistentes.set("authjs.session-token", "jwt-da-sessao");

    await entrar("demo@ledgr.com.br", "s3nha", false);

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

    await entrar("demo@ledgr.com.br", "s3nha", true);

    expect(cookiesGravados).not.toHaveBeenCalled();
  });
});

describe("entrarNaDemonstracao", () => {
  beforeEach(() => {
    signIn.mockReset();
    signIn.mockResolvedValue(undefined);
    cookiesGravados.mockReset();
    cookiesExistentes.clear();
    contaNoAmbiente();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recusa quando a demonstração não foi ligada — mesmo chamada direto", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "");

    expect(await entrarNaDemonstracao(true)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("recusa qualquer valor que não seja exatamente 1", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "true");

    expect(await entrarNaDemonstracao(true)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("entra com a conta de teste do ambiente quando a demonstração está ligada", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "1");

    expect(await entrarNaDemonstracao(true)).toBe(true);
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "demo@ledgr.com.br",
      senha: "s3nha",
      redirect: false,
    });
  });

  it("recusa com a demonstração ligada se produção não configurou a conta", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEDGR_DEMO_ABERTA", "1");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");

    expect(await entrarNaDemonstracao(true)).toBe(false);
    expect(signIn).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { autorizarContaDeTeste, conferirConta, contaDeTeste } from "./conta-teste";

// O repositório é público: a conta que está no código vale só fora de produção.
// Em produção, quem entra é a conta definida nas variáveis de ambiente — ou ninguém.
describe("contaDeTeste", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa a conta das variáveis de ambiente quando elas existem", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "  Demo@Ledgr.com.br ");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "s3nha-do-deploy");

    expect(contaDeTeste()).toEqual({ email: "demo@ledgr.com.br", senha: "s3nha-do-deploy" });
  });

  it("cai na conta de desenvolvimento fora de produção, sem precisar configurar nada", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");

    expect(contaDeTeste()).toEqual({ email: "financeiro@telhacerta.com.br", senha: "ledgr2026" });
  });

  it("não tem conta nenhuma em produção sem as variáveis", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");

    expect(contaDeTeste()).toBeNull();
  });

  it("não aceita só metade da configuração em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.com.br");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");

    expect(contaDeTeste()).toBeNull();
  });
});

describe("conferirConta", () => {
  const conta = { email: "demo@ledgr.com.br", senha: "s3nha" };

  it("aceita a conta ignorando espaços e maiúsculas no e-mail", () => {
    expect(conferirConta(conta, "  Demo@Ledgr.com.br ", "s3nha")).toBe("ok");
  });

  it("distingue e-mail desconhecido de senha errada", () => {
    expect(conferirConta(conta, "outra@empresa.com.br", "s3nha")).toBe("conta_nao_encontrada");
    expect(conferirConta(conta, "demo@ledgr.com.br", "errada")).toBe("senha_incorreta");
  });
});

describe("autorizarContaDeTeste", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function configurar() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.com.br");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "s3nha");
    vi.stubEnv("LEDGR_EMPRESA_ID_TESTE", "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20");
    vi.stubEnv("LEDGR_USUARIO_ID_TESTE", "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d");
  }

  it("devolve o usuário com o empresa_id do ambiente quando a senha confere", () => {
    configurar();
    expect(autorizarContaDeTeste("Demo@Ledgr.com.br", "s3nha")).toEqual({
      id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d",
      email: "demo@ledgr.com.br",
      empresaId: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
    });
  });

  it("usa o empresa_id como id do usuário quando não há um próprio", () => {
    configurar();
    vi.stubEnv("LEDGR_USUARIO_ID_TESTE", "");
    expect(autorizarContaDeTeste("demo@ledgr.com.br", "s3nha")?.id).toBe(
      "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20",
    );
  });

  it("recusa senha errada", () => {
    configurar();
    expect(autorizarContaDeTeste("demo@ledgr.com.br", "ledgr2026")).toBeNull();
  });

  it("recusa a senha que está no código quando produção não configurou conta", () => {
    configurar();
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "");
    vi.stubEnv("LEDGR_CONTA_TESTE_SENHA", "");
    expect(autorizarContaDeTeste("financeiro@telhacerta.com.br", "ledgr2026")).toBeNull();
  });

  it("falha alto sem empresa_id, porque o backend rejeitaria o token", () => {
    configurar();
    vi.stubEnv("LEDGR_EMPRESA_ID_TESTE", "");
    expect(() => autorizarContaDeTeste("demo@ledgr.com.br", "s3nha")).toThrow(
      /LEDGR_EMPRESA_ID_TESTE/,
    );
  });
});

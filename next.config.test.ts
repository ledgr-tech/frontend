import { afterEach, describe, expect, it, vi } from "vitest";

/** Os cabeçalhos que o next.config manda em toda rota, como um mapa. */
async function cabecalhos(): Promise<Map<string, string>> {
  const { default: config } = await import("./next.config");
  const regras = (await config.headers?.()) ?? [];
  const todas = regras.find((regra) => regra.source === "/(.*)");
  return new Map((todas?.headers ?? []).map(({ key, value }) => [key, value]));
}

/** Diretiva → valor, de uma política CSP. */
function diretivas(politica: string): Map<string, string> {
  return new Map(
    politica
      .split(";")
      .map((parte) => parte.trim())
      .filter(Boolean)
      .map((parte) => {
        const [nome, ...valor] = parte.split(/\s+/);
        return [nome, valor.join(" ")];
      }),
  );
}

describe("cabeçalhos de segurança", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("não deixa o app ser aberto dentro de outro site", async () => {
    // clickjacking: alguém emoldura o app e induz o clique
    expect((await cabecalhos()).get("X-Frame-Options")).toBe("DENY");
  });

  it("não deixa o navegador adivinhar o tipo de um arquivo", async () => {
    expect((await cabecalhos()).get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("não vaza o caminho da página para outro site", async () => {
    // a URL da conciliação traz ids de extrato; para fora vai só a origem
    expect((await cabecalhos()).get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("desliga as permissões do navegador que o app não usa", async () => {
    const politica = (await cabecalhos()).get("Permissions-Policy");
    for (const recurso of ["camera=()", "microphone=()", "geolocation=()"]) {
      expect(politica).toContain(recurso);
    }
  });

  it("obriga HTTPS nas próximas visitas", async () => {
    expect((await cabecalhos()).get("Strict-Transport-Security")).toMatch(/^max-age=\d{8,}/);
  });

  it("começa a CSP só observando, sem bloquear nada", async () => {
    const todos = await cabecalhos();
    // o script do tema no <head> é inline: uma CSP imposta sem nonce precisaria
    // de 'unsafe-inline' de qualquer jeito, e errar aqui derruba o app inteiro
    expect(todos.has("Content-Security-Policy")).toBe(false);
    const csp = diretivas(todos.get("Content-Security-Policy-Report-Only") ?? "");
    expect(csp.get("default-src")).toBe("'self'");
    expect(csp.get("object-src")).toBe("'none'");
    expect(csp.get("base-uri")).toBe("'self'");
    expect(csp.get("form-action")).toBe("'self'");
    expect(csp.get("frame-ancestors")).toBe("'none'");
    expect(csp.get("connect-src")).toBe("'self'");
  });

  it("não libera eval em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = diretivas((await cabecalhos()).get("Content-Security-Policy-Report-Only") ?? "");
    expect(csp.get("script-src")).toBe("'self' 'unsafe-inline'");
  });

  it("libera eval só em desenvolvimento, que o React usa para montar a pilha de erros", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const csp = diretivas((await cabecalhos()).get("Content-Security-Policy-Report-Only") ?? "");
    expect(csp.get("script-src")).toBe("'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it("não anuncia que o site roda em Next", async () => {
    const { default: config } = await import("./next.config");
    expect(config.poweredByHeader).toBe(false);
  });
});

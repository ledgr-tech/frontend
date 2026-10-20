import { afterEach, describe, expect, it, vi } from "vitest";

/** Os cabeçalhos que o next.config manda em toda rota, como um mapa. */
async function cabecalhos(): Promise<Map<string, string>> {
  const { default: config } = await import("./next.config");
  const regras = (await config.headers?.()) ?? [];
  const todas = regras.find((regra) => regra.source === "/(.*)");
  return new Map((todas?.headers ?? []).map(({ key, value }) => [key, value]));
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

  it("isola a janela do app de páginas de outros sites", async () => {
    expect((await cabecalhos()).get("Cross-Origin-Opener-Policy")).toBe("same-origin");
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

  it("deixa a CSP para o proxy, que põe um nonce por página", async () => {
    const todos = await cabecalhos();
    expect(todos.has("Content-Security-Policy")).toBe(false);
    expect(todos.has("Content-Security-Policy-Report-Only")).toBe(false);
  });

  it("não anuncia que o site roda em Next", async () => {
    const { default: config } = await import("./next.config");
    expect(config.poweredByHeader).toBe(false);
  });
});

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

describe("o painel interno (#333)", () => {
  it("sai sem cache em toda tela do /admin, e só nelas", async () => {
    const { unstable_getResponseFromNextConfig } = await import("next/experimental/testing/server");
    const { default: nextConfig } = await import("./next.config");
    const cache = async (caminho: string) =>
      (await unstable_getResponseFromNextConfig({ url: `http://localhost${caminho}`, nextConfig })).headers.get("Cache-Control");
    for (const caminho of ["/admin", "/admin/estados", "/admin/3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20/pagamentos"]) {
      expect(await cache(caminho), caminho).toBe("no-store");
    }
    for (const caminho of ["/", "/visao-geral", "/administracao"]) expect(await cache(caminho), caminho).toBeNull();
  });
});

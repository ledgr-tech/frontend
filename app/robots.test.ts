import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function robotsCom(ambiente: Record<string, string>) {
  for (const [chave, valor] of Object.entries(ambiente)) vi.stubEnv(chave, valor);
  const { default: robots } = await import("./robots");
  const { default: sitemap } = await import("./sitemap");
  return { robots: robots(), sitemap: sitemap() };
}

describe("robots.txt e sitemap", () => {
  it("na produção, libera o site, tira as telas com login e aponta o sitemap do domínio", async () => {
    const { robots, sitemap } = await robotsCom({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "ledgrfinance.com.br" });
    expect(robots.rules).toMatchObject({ allow: "/" });
    expect((robots.rules as { disallow: string[] }).disallow).toEqual(expect.arrayContaining(["/visao-geral", "/ajuda", "/api/", "/e/"]));
    expect(robots.sitemap).toBe("https://ledgrfinance.com.br/sitemap.xml");
    expect(sitemap.map((p) => p.url)).toEqual([
      "https://ledgrfinance.com.br",
      "https://ledgrfinance.com.br/cadastro",
      "https://ledgrfinance.com.br/privacidade",
      "https://ledgrfinance.com.br/termos",
    ]);
  });

  it("nas prévias dos PRs, nada entra no Google", async () => {
    const { robots } = await robotsCom({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "ledgrfinance.com.br" });
    expect(robots).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

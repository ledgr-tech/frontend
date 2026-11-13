import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

describe("proxy", () => {
  it("manda a CSP aplicada com um nonce novo, e o mesmo nonce para o Next e o layout", () => {
    const primeira = proxy(new NextRequest("http://localhost/visao-geral"));
    const segunda = proxy(new NextRequest("http://localhost/visao-geral"));

    const politica = primeira.headers.get("Content-Security-Policy") ?? "";
    const nonce = politica.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(primeira.headers.has("Content-Security-Policy-Report-Only")).toBe(false);

    // o pedido segue com a política e o x-nonce, que o Next e o layout leem ao renderizar
    expect(primeira.headers.get("x-middleware-request-content-security-policy")).toBe(politica);
    expect(primeira.headers.get("x-middleware-request-x-nonce")).toBe(nonce);

    expect(segunda.headers.get("Content-Security-Policy")).not.toBe(politica);
  });
});

describe("proxy: a empresa da URL (#169)", () => {
  const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
  const empresaNoPedido = (resposta: Response) => resposta.headers.get("x-middleware-request-x-ledgr-empresa");
  const cabecalhosDoPedido = (resposta: Response) => (resposta.headers.get("x-middleware-override-headers") ?? "").split(",");

  it("passa ao pedido a empresa de /e/<uuid>/...", () => {
    expect(empresaNoPedido(proxy(new NextRequest(`http://localhost/e/${A}/visao-geral`)))).toBe(A);
    // sem resto também: /e/<uuid> é a empresa
    expect(empresaNoPedido(proxy(new NextRequest(`http://localhost/e/${A}`)))).toBe(A);
  });

  it("descarta um x-ledgr-empresa que veio de fora, em caminho sem empresa", () => {
    const resposta = proxy(new NextRequest("http://localhost/visao-geral", { headers: { "x-ledgr-empresa": A } }));
    expect(empresaNoPedido(resposta)).toBeNull();
    expect(cabecalhosDoPedido(resposta)).not.toContain("x-ledgr-empresa");
  });

  it("o cabeçalho de fora não vence a URL: vale a empresa do caminho", () => {
    const outra = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    const resposta = proxy(new NextRequest(`http://localhost/e/${A}/extratos`, { headers: { "x-ledgr-empresa": outra } }));
    expect(empresaNoPedido(resposta)).toBe(A);
  });

  it("um segmento que não é UUID não vira empresa, e o cabeçalho de fora também cai", () => {
    for (const caminho of ["/e/abc/visao-geral", "/e/", "/e", `/e/${A}extra/x`]) {
      const resposta = proxy(new NextRequest(`http://localhost${caminho}`, { headers: { "x-ledgr-empresa": A } }));
      expect(empresaNoPedido(resposta)).toBeNull();
      expect(cabecalhosDoPedido(resposta)).not.toContain("x-ledgr-empresa");
    }
  });

  it("no prefetch também vale a empresa da URL, nunca a de fora, e não há CSP", () => {
    // o matcher não pode pular o prefetch: sem o proxy, o x-ledgr-empresa de fora chegaria ao backend
    expect(JSON.stringify(config)).not.toMatch(/prefetch/);
    const outra = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    const pedidosDePrefetch: Record<string, string>[] = [{ "next-router-prefetch": "1" }, { purpose: "prefetch" }];
    for (const prefetch of pedidosDePrefetch) {
      const comEmpresa = proxy(
        new NextRequest(`http://localhost/e/${A}/dashboard`, { headers: { ...prefetch, "x-ledgr-empresa": outra } }),
      );
      expect(empresaNoPedido(comEmpresa)).toBe(A);
      expect(comEmpresa.headers.has("Content-Security-Policy")).toBe(false);

      const semEmpresa = proxy(new NextRequest("http://localhost/visao-geral", { headers: { ...prefetch, "x-ledgr-empresa": outra } }));
      expect(empresaNoPedido(semEmpresa)).toBeNull();
      expect(cabecalhosDoPedido(semEmpresa)).not.toContain("x-ledgr-empresa");
    }
  });

  it("a CSP e o nonce seguem junto da empresa", () => {
    const resposta = proxy(new NextRequest(`http://localhost/e/${A}/historico`));
    expect(resposta.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
    expect(resposta.headers.get("Content-Security-Policy")).toBeTruthy();
  });
});

describe("proxy: onde ele roda (S1-09)", async () => {
  const { unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server");
  const { readdirSync } = await import("node:fs");
  const { join, relative } = await import("node:path");
  const roda = (url: string) => unstable_doesMiddlewareMatch({ config, url });
  const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";

  it("roda em tela com ponto no caminho: sem ele a tela sairia sem CSP e com o x-ledgr-empresa de fora", () => {
    for (const url of [`/e/${A}/conciliacoes/a.b`, `/e/${A}/conciliacoes/a.png`, "/login/a.b", "/ajuda/a.b", "/admin/a.b", "/visao-geral"]) {
      expect(roda(url), url).toBe(true);
    }
  });

  it("não roda no que é arquivo estático", () => {
    const estaticos = [
      "/mascotes/x.png",
      "/email/logo.png",
      "/email/fontes/x.woff2",
      "/ajuda/empresas.webp",
      "/ajuda/comparacao--figuras.json",
      "/ajuda/conteudo.json",
      "/favicon.ico",
      "/icon.png",
      "/apple-icon.png",
      "/robots.txt",
      "/sitemap.xml",
      "/_next/static/x.js",
      "/_next/image",
      "/_vercel/insights/script.js",
      "/api/auth/session",
    ];
    for (const url of estaticos) expect(roda(url), url).toBe(false);
  });

  it("cada arquivo de public/ está fora do proxy: uma pasta ou extensão nova obriga a decidir", () => {
    // cada arquivo de verdade, até o fim da árvore
    for (const arquivo of readdirSync("public", { recursive: true, withFileTypes: true })) {
      if (!arquivo.isFile()) continue;
      const url = `/${relative("public", join(arquivo.parentPath, arquivo.name)).replaceAll("\\", "/")}`;
      expect(roda(url), url).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { novoNonce, politicaDeConteudo } from "./csp";

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

describe("politicaDeConteudo", () => {
  it("só roda script com o nonce da página, e nada inline sem ele", () => {
    const csp = diretivas(politicaDeConteudo("abc123", false));
    expect(csp.get("script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp.get("script-src")).not.toContain("unsafe-inline");
  });

  it("libera eval só em desenvolvimento, que o React usa para montar a pilha de erros", () => {
    expect(diretivas(politicaDeConteudo("n", false)).get("script-src")).not.toContain("unsafe-eval");
    expect(diretivas(politicaDeConteudo("n", true)).get("script-src")).toContain("'unsafe-eval'");
  });

  it("aceita os style=\"\" do React, sem nonce na diretiva (com ele o navegador ignoraria o unsafe-inline)", () => {
    expect(diretivas(politicaDeConteudo("n", false)).get("style-src")).toBe("'self' 'unsafe-inline'");
  });

  it("fecha o resto na própria origem", () => {
    const csp = diretivas(politicaDeConteudo("n", false));
    expect(csp.get("default-src")).toBe("'self'");
    expect(csp.get("connect-src")).toBe("'self'");
    expect(csp.get("object-src")).toBe("'none'");
    expect(csp.get("base-uri")).toBe("'self'");
    expect(csp.get("frame-ancestors")).toBe("'none'");
    // o login com Google sai de um formulário para o Google
    expect(csp.get("form-action")).toBe("'self' https://accounts.google.com");
  });
});

describe("novoNonce", () => {
  it("é diferente a cada página e cabe num atributo", () => {
    const nonces = new Set(Array.from({ length: 50 }, novoNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

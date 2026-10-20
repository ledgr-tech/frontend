import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

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

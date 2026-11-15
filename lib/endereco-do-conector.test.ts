import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enderecoPublicoDoConector, enderecosPublicos } from "./endereco-do-conector";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

const fetch = vi.fn();

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
  vi.stubEnv("LEDGR_API_URL", "https://backend.up.railway.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enderecoPublicoDoConector", () => {
  it("usa o endereço que o backend publica, e não o host por onde o app fala com ele", async () => {
    fetch.mockResolvedValue(
      Response.json({ resource: "https://api.ledgrfinance.com.br/mcp", authorization_servers: ["https://api.ledgrfinance.com.br"] }),
    );

    expect(await enderecosPublicos()).toEqual({ conector: "https://api.ledgrfinance.com.br/mcp", api: "https://api.ledgrfinance.com.br" });
    expect(String(fetch.mock.calls[0][0])).toMatch(/\/\.well-known\/oauth-protected-resource$/);
    expect(new Headers(fetch.mock.calls[0][1].headers).has("Authorization")).toBe(false);
  });

  it.each([
    ["a conexão desligada (503)", () => Response.json({ detail: "x" }, { status: 503 })],
    ["um backend sem a rota (404)", () => Response.json({ detail: "Not Found" }, { status: 404 })],
    ["uma resposta sem o endereço", () => Response.json({})],
    ["um endereço que não é http", () => Response.json({ resource: "javascript:alert(1)" })],
  ])("com %s, monta pelo LEDGR_API_URL como antes", async (_nome, resposta) => {
    fetch.mockResolvedValue(resposta());
    expect(await enderecosPublicos()).toEqual({ conector: "https://backend.up.railway.app/mcp", api: "https://backend.up.railway.app" });
  });

  it("com o backend fora do ar, monta pelo LEDGR_API_URL", async () => {
    fetch.mockRejectedValue(new TypeError("fetch failed"));
    expect(await enderecoPublicoDoConector()).toBe("https://backend.up.railway.app/mcp");
  });
});

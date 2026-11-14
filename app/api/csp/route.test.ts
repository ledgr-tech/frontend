import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

function pedido(corpo: string, tipo = "application/csp-report", tamanho: string | null = String(corpo.length)): Request {
  const cabecalhos: Record<string, string> = { "content-type": tipo };
  if (tamanho !== null) cabecalhos["content-length"] = tamanho;
  return new Request("http://localhost/api/csp", { method: "POST", body: corpo, headers: cabecalhos });
}

describe("POST /api/csp (S1-19c)", () => {
  it("registra só a diretiva, o bloqueado e a página, e responde 204 sem corpo", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const relatorio = {
      "csp-report": { "violated-directive": "script-src", "blocked-uri": "https://mal.example/x.js", "document-uri": "https://ledgr.app/", extra: "x".repeat(500) },
    };

    const resposta = await POST(pedido(JSON.stringify(relatorio)));

    expect(resposta.status).toBe(204);
    expect(await resposta.text()).toBe("");
    expect(aviso).toHaveBeenCalledWith(
      "[csp] violação",
      JSON.stringify({ diretiva: "script-src", bloqueado: "https://mal.example/x.js", pagina: "https://ledgr.app/" }),
    );
  });

  it("aceita o formato novo do navegador (reports+json)", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const relatorio = [{ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://x.example/a.png", documentURL: "https://ledgr.app/" } }];

    expect((await POST(pedido(JSON.stringify(relatorio), "application/reports+json"))).status).toBe(204);
    expect(aviso.mock.calls[0][1]).toContain("img-src");
  });

  it("recusa sem registrar: tipo errado, sem tamanho, grande demais ou fora do formato", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await POST(pedido("{}", "text/plain"))).status).toBe(415);
    expect((await POST(pedido("{}", "application/csp-report", null))).status).toBe(413);
    expect((await POST(pedido("x", "application/csp-report", "20000"))).status).toBe(413);
    expect((await POST(pedido("não é json"))).status).toBe(400);
    expect(aviso).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { GET } from "./route";

const baixarDoBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  baixarDoBackend: (caminho: string, opcoes?: { empresa?: string }) => baixarDoBackend(caminho, opcoes),
}));

const EXTRATO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const EMPRESA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

function pedir(id: string, busca = "") {
  return GET(new Request(`http://localhost:3200/api/extratos/${id}/arquivo-original${busca}`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/extratos/[id]/arquivo-original", () => {
  beforeEach(() => {
    baixarDoBackend.mockReset();
  });

  it("repassa os bytes como download genérico, com a empresa ativa", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x4f, 0x46, 0x58]);
    baixarDoBackend.mockResolvedValue(
      new Response(bytes, { headers: { "Content-Type": "text/html", "Content-Disposition": 'attachment; filename="x.ofx"' } }),
    );

    const resposta = await pedir(EXTRATO, `?empresa=${EMPRESA}`);

    expect(baixarDoBackend).toHaveBeenCalledWith(`/extratos/${EXTRATO}/arquivo-original`, { empresa: EMPRESA });
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(bytes);
  });

  it("não chama o backend com id ou empresa fora do formato", async () => {
    expect((await pedir("../me")).status).toBe(404);
    expect((await pedir(EXTRATO, "?empresa=x")).status).toBe(404);
    expect(baixarDoBackend).not.toHaveBeenCalled();
  });

  it.each([
    [401, 401],
    [403, 403],
    [404, 404],
    [429, 429],
    [503, 502],
    [500, 502],
  ])("o %i do backend vira %i com o texto da tela", async (doBackend, daRota) => {
    baixarDoBackend.mockRejectedValue(new ErroBackend(doBackend, "x"));
    const resposta = await pedir(EXTRATO);
    expect(resposta.status).toBe(daRota);
    expect((await resposta.json()).erro).toEqual(expect.any(String));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { GET } from "./route";

// A rede é a fronteira: o que se testa é o caminho pedido ao backend e o que a
// rota devolve ao navegador. ErroBackend roda de verdade.
const baixarDoBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  baixarDoBackend: (caminho: string) => baixarDoBackend(caminho),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

const BOM = [0xef, 0xbb, 0xbf];
const CSV = new Uint8Array([...BOM, ...new TextEncoder().encode("Status;Descrição (banco)\r\nMatch exato;Pão\r\n")]);

function pedir(id: string, busca = "") {
  const url = `http://localhost:3200/api/conciliacoes/${id}/exportar${busca}`;
  return GET(new Request(url), { params: Promise.resolve({ id }) });
}

describe("GET /api/conciliacoes/[id]/exportar", () => {
  beforeEach(() => {
    baixarDoBackend.mockReset();
  });

  it("repassa o CSV do par byte a byte, com os cabeçalhos do backend", async () => {
    baixarDoBackend.mockResolvedValue(
      new Response(CSV, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="conciliacao-3f1c0d5e.csv"',
          "Cache-Control": "no-store",
        },
      }),
    );

    const resposta = await pedir(BANCO, `?sistema=${SISTEMA}`);

    expect(baixarDoBackend).toHaveBeenCalledWith(
      `/conciliacoes/${BANCO}/exportar?extrato_sistema_id=${SISTEMA}`,
    );
    expect(resposta.status).toBe(200);
    // o BOM na frente continua lá: sem ele o Excel quebra "Descrição" e "Pão"
    expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(CSV);
    expect(resposta.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(resposta.headers.get("Content-Disposition")).toBe(
      'attachment; filename="conciliacao-3f1c0d5e.csv"',
    );
    expect(resposta.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sem o par, pede o extrato do banco inteiro", async () => {
    baixarDoBackend.mockResolvedValue(new Response(CSV, { headers: { "Content-Type": "text/csv" } }));

    const resposta = await pedir(BANCO);

    expect(baixarDoBackend).toHaveBeenCalledWith(`/conciliacoes/${BANCO}/exportar`);
    // o arquivo é da empresa: nada de cache no caminho, mesmo se o backend esquecer
    expect(resposta.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    ["o extrato do banco", "nao-e-uuid", ""],
    ["o extrato do sistema", BANCO, "?sistema=../execucoes"],
  ])("recusa %s fora do formato, sem chamar o backend", async (_, id, busca) => {
    const resposta = await pedir(id, busca);

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ erro: "Conciliação não encontrada." });
    expect(baixarDoBackend).not.toHaveBeenCalled();
  });

  it("devolve a sessão vencida como 401, para a tela mandar ao login", async () => {
    baixarDoBackend.mockRejectedValue(new ErroBackend(401, "Token expirado"));

    const resposta = await pedir(BANCO, `?sistema=${SISTEMA}`);

    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toEqual({ erro: "Sua sessão expirou. Entre de novo para continuar." });
  });

  it("traduz o extrato que não existe ou é de outra empresa", async () => {
    baixarDoBackend.mockRejectedValue(new ErroBackend(404, "Extrato não encontrado."));

    const resposta = await pedir(BANCO, `?sistema=${SISTEMA}`);

    expect(resposta.status).toBe(404);
    expect(await resposta.json()).toEqual({ erro: "Conciliação não encontrada." });
  });

  it.each([
    ["um erro do backend", new ErroBackend(500, "Erro interno.")],
    ["a rede caída", new TypeError("fetch failed")],
  ])("com %s, pede para tentar de novo", async (_, erro) => {
    baixarDoBackend.mockRejectedValue(erro);

    const resposta = await pedir(BANCO, `?sistema=${SISTEMA}`);

    expect(resposta.status).toBe(502);
    expect(await resposta.json()).toEqual({
      erro: "Não foi possível gerar o CSV agora. Tente de novo em instantes.",
    });
  });
});

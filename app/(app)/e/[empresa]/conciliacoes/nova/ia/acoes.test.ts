import { beforeEach, describe, expect, it, vi } from "vitest";
import { importarViaIa } from "./acoes";

const chamarBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
}));

function dadosDoArquivo(tamanho: number): FormData {
  const arquivo = new File(["{}"], "resposta.json", { type: "application/json" });
  Object.defineProperty(arquivo, "size", { value: tamanho });
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  return dados;
}

describe("importarViaIa: limite do envio", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
    chamarBackend.mockResolvedValue({ importacao_id: "rascunho", quantidade_lancamentos: 2 });
  });

  it("recusa acima de 4 MB mesmo quando o navegador não validou", async () => {
    const resultado = await importarViaIa(dadosDoArquivo(Math.round(4.8 * 1024 * 1024)));

    expect(resultado).toMatchObject({ ok: false, status: 413, erro: expect.stringContaining("4 MB") });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("aceita exatamente 4 MB e envia o arquivo para o backend", async () => {
    const dados = dadosDoArquivo(4 * 1024 * 1024);

    expect(await importarViaIa(dados)).toEqual({ ok: true, dados: { importacaoId: "rascunho", quantidade: 2 } });
    expect(chamarBackend).toHaveBeenCalledWith("/importacoes-ia", {
      method: "POST",
      corpo: expect.any(FormData),
    });
    expect((chamarBackend.mock.calls[0][1].corpo as FormData).get("arquivo")).toBe(dados.get("arquivo"));
  });

  it("pede um arquivo quando ele está ausente", async () => {
    expect(await importarViaIa(new FormData())).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

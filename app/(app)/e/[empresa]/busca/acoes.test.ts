import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { buscarLancamentos } from "./acoes";

const chamarBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";
const LINHA = "a0a0a0a0-0000-4000-8000-000000000001";
const LANCAMENTO = { id: BANCO, data: "2026-09-13", valor: "-1250.50", descricao: "Fornecedor Aço Norte", tipo: "debito" };
const ITEM = {
  conciliacao_id: LINHA, extrato_banco_id: BANCO, extrato_sistema_id: SISTEMA,
  chave: `b:${BANCO}`, status: "divergente_valor", competencia: "2026-09",
  lancamento_banco: LANCAMENTO,
  lancamento_sistema: { ...LANCAMENTO, descricao: "Outro texto do sistema", valor: "-1200.00" },
};
const pagina = (itens: unknown[], total = itens.length, offset = 0) => ({ itens, total, limit: 10, offset });

beforeEach(() => {
  chamarBackend.mockReset().mockResolvedValue(pagina([ITEM]));
});

describe("buscarLancamentos", () => {
  it.each(["", " \n\t ", null, 42, {}])("recusa termo vazio ou que não é texto (%j) sem backend", async (termo) => {
    expect(await buscarLancamentos(termo as string)).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("apara sem interpretar nem mudar caixa, palavras, valor ou data", async () => {
    await buscarLancamentos("  Aço Norte 13/10 R$ 1.250,50  ");
    const consulta = new URLSearchParams(chamarBackend.mock.calls[0][0].split("?")[1]);
    expect(consulta.get("q")).toBe("Aço Norte 13/10 R$ 1.250,50");
    expect(consulta.get("limit")).toBe("10");
    expect(consulta.get("offset")).toBe("0");
  });

  it("corta em 100 caracteres sem partir o emoji da posição 100", async () => {
    await buscarLancamentos("x".repeat(99) + "😀resto");
    const consulta = new URLSearchParams(chamarBackend.mock.calls[0][0].split("?")[1]);
    expect(consulta.get("q")).toBe("x".repeat(99) + "😀");
  });

  it("abre o conciliacao_id no par e usa o lado do banco quando os dois existem", async () => {
    expect(await buscarLancamentos("Aço")).toEqual({
      ok: true,
      dados: { total: 1, limit: 10, offset: 0, itens: [{
        id: LINHA, href: `/conciliacoes/${BANCO}/${LINHA}?sistema=${SISTEMA}`,
        descricao: LANCAMENTO.descricao, data: "2026-09-13", valor: -1250.5, competencia: "2026-09",
      }] },
    });
  });

  it("usa o sistema quando o banco é null e preserva competência null e valor zero", async () => {
    chamarBackend.mockResolvedValue(pagina([{ ...ITEM, competencia: null, lancamento_banco: null, lancamento_sistema: { ...LANCAMENTO, valor: "0" } }]));
    const resposta = await buscarLancamentos("Fornecedor");
    expect(resposta.ok && resposta.dados.itens[0]).toMatchObject({ descricao: LANCAMENTO.descricao, valor: 0, competencia: null });
  });

  it("descarta linha sem os dois lados ou com id, data, valor e competência malformados", async () => {
    chamarBackend.mockResolvedValue(pagina([
      ITEM, null, {}, { ...ITEM, conciliacao_id: "../admin" },
      { ...ITEM, lancamento_banco: null, lancamento_sistema: null },
      { ...ITEM, competencia: "2026-13" },
      ...["", "Infinity", "x"].map((valor) => ({ ...ITEM, lancamento_banco: { ...LANCAMENTO, valor } })),
      { ...ITEM, lancamento_banco: { ...LANCAMENTO, data: "2026-02-30" } },
    ]));
    const resposta = await buscarLancamentos("Fornecedor");
    expect(resposta.ok && resposta.dados.itens).toHaveLength(1);
  });

  it("pede a página pelo offset, mantendo limit em 10", async () => {
    chamarBackend.mockResolvedValue(pagina([], 30, 20));
    expect(await buscarLancamentos("tarifa", 20)).toEqual({ ok: true, dados: pagina([], 30, 20) });
    expect(chamarBackend).toHaveBeenCalledExactlyOnceWith("/busca?q=tarifa&limit=10&offset=20");
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "10", null])("recusa offset inválido %j sem backend", async (offset) => {
    expect(await buscarLancamentos("tarifa", offset as number)).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it.each([
    [401, "Sua sessão expirou. Entre de novo para continuar."],
    [429, "Muitas buscas seguidas. Espere um pouco."],
    [404, "Não deu para buscar agora."],
    [500, "Não deu para buscar agora."],
  ])("traduz o status %i sem expor o detalhe interno", async (status, mensagem) => {
    chamarBackend.mockRejectedValue(new ErroBackend(status, "detalhe interno"));
    expect(await buscarLancamentos("tarifa")).toEqual({ ok: false, status, erro: mensagem });
  });

  it("preserva o texto de conta inativa", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(403, "A conta está inativa.", [], {}, undefined, [], "conta_inativa"));
    expect(await buscarLancamentos("tarifa")).toEqual({ ok: false, status: 403, erro: "A conta está inativa." });
  });

  it("sem resposta do servidor usa SEM_SERVIDOR", async () => {
    chamarBackend.mockRejectedValue(new Error("LEDGR_API_URL não configurado"));
    expect(await buscarLancamentos("tarifa")).toEqual({ ok: false, status: 0, erro: SEM_SERVIDOR });
  });

  it("resposta sem página válida não vira uma busca vazia", async () => {
    chamarBackend.mockResolvedValue({ itens: [], total: "0", offset: 0, limit: 10 });
    expect(await buscarLancamentos("tarifa")).toEqual({ ok: false, status: 502, erro: "Não deu para buscar agora." });
  });
});

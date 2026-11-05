import { beforeEach, describe, expect, it, vi } from "vitest";

const { chamarBackend } = vi.hoisted(() => ({ chamarBackend: vi.fn() }));

vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend,
}));

import { ErroBackend } from "@/lib/backend";
import { contarContasPorUf, detalharConta, listarContas, listarPagamentosDaConta } from "./acoes";

const ID = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";

describe("cidade e UF no painel (backend #184)", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it.each([
    ["SP", "uf=SP"],
    ["nao_informada", "uf=nao_informada"],
  ])("filtra as contas por %s", async (uf, esperado) => {
    chamarBackend.mockResolvedValue({ total: 0, limit: 20, offset: 0, itens: [] });
    await listarContas({ uf });
    expect(chamarBackend.mock.calls[0][0]).toContain(esperado);
  });

  it.each(["sp", "XX", "' or 1=1"])("não manda ao backend a UF inválida %s", async (uf) => {
    chamarBackend.mockResolvedValue({ total: 0, limit: 20, offset: 0, itens: [] });
    await listarContas({ uf });
    expect(chamarBackend.mock.calls[0][0]).not.toContain("uf=");
  });

  it("lê cidade e UF, e um backend antes do #184 vira null", async () => {
    const base = { id: ID, razao_social: "R", cnpj: "1", plano: null, situacao: "teste", teste_termina_em: null, assinatura_ativa: false, inativa: false, criada_em: "2026-11-01T00:00:00Z" };
    chamarBackend.mockResolvedValue({ total: 2, limit: 20, offset: 0, itens: [{ ...base, cidade: "Porto Alegre", uf: "RS" }, base] });
    const r = await listarContas({});
    expect(r.ok && r.dados.itens.map((c) => [c.cidade, c.uf])).toEqual([["Porto Alegre", "RS"], [null, null]]);
  });

  it("adapta a contagem por UF", async () => {
    chamarBackend.mockResolvedValue({ contas: 3, assinando: 1, ufs: [{ uf: "SP", contas: 2, assinando: 1 }], nao_informada: { contas: 1, assinando: 0 } });
    const r = await contarContasPorUf();
    expect(chamarBackend).toHaveBeenCalledWith("/admin/contas/por-uf");
    expect(r).toEqual({ ok: true, dados: { contas: 3, assinando: 1, ufs: [{ uf: "SP", contas: 2, assinando: 1 }], naoInformada: { contas: 1, assinando: 0 } } });
  });

  it("num backend antes do #184, o 422 diz que a contagem não está disponível", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(422, "x"));
    const r = await contarContasPorUf();
    expect(r).toEqual({ ok: false, status: 422, erro: "A contagem por estado ainda não está disponível neste backend." });
  });
});

describe("histórico de pagamentos da conta", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("pede a página certa e adapta os itens", async () => {
    chamarBackend.mockResolvedValue({
      total: 25,
      limit: 20,
      offset: 20,
      itens: [{ id: "p", valor_centavos: 100, moeda: "brl", status: "paga", periodo_inicio: null, periodo_fim: null, ocorrido_em: "2026-11-01T00:00:00Z" }],
    });
    const r = await listarPagamentosDaConta(ID, 2);
    expect(chamarBackend).toHaveBeenCalledWith(`/admin/contas/${ID}/pagamentos?limit=20&offset=20`);
    expect(r.ok && r.dados.itens[0].valorCentavos).toBe(100);
  });

  it("um id que não é uuid não chega ao backend", async () => {
    expect(await listarPagamentosDaConta("../outra")).toMatchObject({ ok: false, status: 404 });
    expect(await detalharConta("../outra")).toMatchObject({ ok: false, status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

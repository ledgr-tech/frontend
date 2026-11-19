import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chamarBackend } = vi.hoisted(() => ({ chamarBackend: vi.fn() }));
const { gravarCookie, apagarCookie, redirecionar } = vi.hoisted(() => ({
  gravarCookie: vi.fn(), apagarCookie: vi.fn(), redirecionar: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ set: gravarCookie, delete: apagarCookie }) }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    redirecionar(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend,
}));

import { ErroBackend } from "@/lib/backend";
import {
  agirNaConta, buscarContas, cancelarAssinatura, contarContasPorUf, darCupom, detalharConta,
  listarCancelamentos, listarContas, listarCupons, listarPagamentos, listarPagamentosDaConta,
  listarVencimentos, manterAssinatura,
} from "./acoes";
import { COOKIE_DA_BUSCA } from "./situacao";

const ID = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";

const ACOES = [
  { nome: "listarPagamentos", executar: () => listarPagamentos({}) },
  { nome: "listarPagamentosDaConta", executar: () => listarPagamentosDaConta(ID) },
  { nome: "contarContasPorUf", executar: () => contarContasPorUf() },
  { nome: "listarCancelamentos", executar: () => listarCancelamentos({}) },
  { nome: "listarVencimentos", executar: () => listarVencimentos({}) },
  { nome: "cancelarAssinatura", executar: () => cancelarAssinatura(ID, "fim_do_periodo", "Pedido de teste") },
  { nome: "manterAssinatura", executar: () => manterAssinatura(ID, "Pedido de teste") },
  { nome: "listarCupons", executar: () => listarCupons() },
  { nome: "darCupom", executar: () => darCupom(ID, "cupom-teste", 30) },
  { nome: "listarContas", executar: () => listarContas({}) },
  { nome: "detalharConta", executar: () => detalharConta(ID) },
  { nome: "agirNaConta", executar: () => agirNaConta(ID, "inativar", "Pedido de teste") },
];

describe("recusas e textos seguros das actions do painel", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it.each(ACOES)("$nome preserva a recusa 403 do backend", async ({ executar }) => {
    const erro = "Acesso restrito à equipe do Ledgr.";
    chamarBackend.mockRejectedValue(new ErroBackend(403, erro));
    expect(await executar()).toEqual({ ok: false, status: 403, erro });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });

  it.each(ACOES)("$nome traduz o 401 sem expor seu detalhe", async ({ executar }) => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "detalhe interno qualquer"));
    expect(await executar()).toEqual({ ok: false, status: 401, erro: "Entre de novo para usar o painel." });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });

  it.each(["Entre de novo para usar o painel.", "Token de acesso inválido.", "Sessão expirada."])
    ("normaliza o 401: %s", async (detalhe) => {
      chamarBackend.mockRejectedValue(new ErroBackend(401, detalhe));
      expect(await listarContas({})).toEqual({ ok: false, status: 401, erro: "Entre de novo para usar o painel." });
    });

  it.each([
    [404, "Sem rota para GET /admin/contas."],
    [409, "detalhe interno qualquer"],
  ])("esconde o detalhe desconhecido do %s", async (status, detalhe) => {
    chamarBackend.mockRejectedValue(new ErroBackend(status, detalhe));
    expect(await listarContas({})).toEqual({ ok: false, status, erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  });

  it.each([
    [403, "Acesso restrito à equipe do Ledgr."],
    [404, "Conta não encontrada."],
    [409, "A conta já está inativa."],
    [409, "A conta não está inativa."],
    [409, "O piloto já está ligado nesta conta."],
    [409, "O piloto já está desligado nesta conta."],
    [409, "A conta não tem uma assinatura ativa."],
    [409, "O cancelamento já está agendado para o fim do período."],
    [409, "A assinatura não tem cancelamento agendado."],
    [404, "Cupom não encontrado ou não está mais válido."],
    [409, "A conta não tem um administrador ativo para receber o cupom."],
    [422, "A data inicial é depois da final."],
    [503, "A cobrança não está disponível no momento."],
    [502, "Não foi possível falar com a Stripe agora. Tente de novo em instantes."],
  ])("preserva o texto conhecido do %s: %s", async (status, erro) => {
    chamarBackend.mockRejectedValue(new ErroBackend(status, erro));
    expect(await listarContas({})).toEqual({ ok: false, status, erro });
  });

  it("mantém a orientação do limite 429", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(429, "detalhe interno"));
    expect(await listarContas({})).toEqual({ ok: false, status: 429, erro: "Muitas chamadas seguidas. Espere um minuto e tente de novo." });
  });

  it("mantém a orientação do 422 com campos", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(422, "detalhe interno", ["motivo"]));
    expect(await agirNaConta(ID, "inativar", "Pedido de teste")).toEqual({ ok: false, status: 422, erro: "O motivo precisa ter de 1 a 500 caracteres." });
  });
});

describe("buscarContas", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
    gravarCookie.mockReset();
    apagarCookie.mockReset();
    redirecionar.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  function formulario(valores: Record<string, string>) {
    const dados = new FormData();
    for (const [chave, valor] of Object.entries(valores)) dados.set(chave, valor);
    return dados;
  }

  it.each(["production", "development", "test"] as const)("guarda a busca com as opções certas em %s e só redireciona os filtros", async (ambiente) => {
    vi.stubEnv("NODE_ENV", ambiente);
    const dados = formulario({ busca: "  financeiro@cliente.test  ", situacao: "ativo", ordem: "teste_termina_em", uf: "RS", pagina: "3", outro: "ignorar", com_busca: "valor-de-fora" });
    await expect(buscarContas(dados)).rejects.toThrow("NEXT_REDIRECT");
    expect(gravarCookie).toHaveBeenCalledExactlyOnceWith(COOKIE_DA_BUSCA, "financeiro@cliente.test", {
      httpOnly: true, sameSite: "strict", secure: ambiente === "production", path: "/admin", maxAge: 3600,
    });
    expect(apagarCookie).not.toHaveBeenCalled();
    expect(redirecionar).toHaveBeenCalledExactlyOnceWith("/admin?situacao=ativo&ordem=teste_termina_em&uf=RS&com_busca=1");
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it.each(["", "   "])("apaga a busca vazia %j no mesmo path e volta a /admin sem filtros", async (busca) => {
    await expect(buscarContas(formulario({ busca, situacao: "", ordem: "", uf: "", com_busca: "1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(apagarCookie).toHaveBeenCalledExactlyOnceWith({ name: COOKIE_DA_BUSCA, path: "/admin" });
    expect(gravarCookie).not.toHaveBeenCalled();
    expect(redirecionar).toHaveBeenCalledExactlyOnceWith("/admin");
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("corta a busca em 100 caracteres depois de tirar os espaços", async () => {
    await expect(buscarContas(formulario({ busca: `  ${"x".repeat(120)}  ` }))).rejects.toThrow("NEXT_REDIRECT");
    expect(gravarCookie).toHaveBeenCalledWith(COOKIE_DA_BUSCA, "x".repeat(100), expect.objectContaining({ path: "/admin", maxAge: 3600 }));
    expect(redirecionar).toHaveBeenCalledExactlyOnceWith("/admin?com_busca=1");
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("preserva o emoji na posição 100 sem produzir surrogate solto no cookie", async () => {
    const esperado = "x".repeat(99) + "😀";
    // O cookie real codifica o valor: um surrogate solto faria esse passo lançar URIError.
    gravarCookie.mockImplementation((_nome: string, valor: string) => { encodeURIComponent(valor); });
    await expect(buscarContas(formulario({ busca: esperado + "zz" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(gravarCookie).toHaveBeenCalledExactlyOnceWith(COOKIE_DA_BUSCA, esperado, expect.objectContaining({ path: "/admin" }));
    expect(redirecionar).toHaveBeenCalledExactlyOnceWith("/admin?com_busca=1");
  });

  it("sem busca, mantém os filtros sem o marcador", async () => {
    await expect(buscarContas(formulario({ busca: "", situacao: "ativo", uf: "RS", com_busca: "1" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(apagarCookie).toHaveBeenCalledExactlyOnceWith({ name: COOKIE_DA_BUSCA, path: "/admin" });
    expect(redirecionar).toHaveBeenCalledExactlyOnceWith("/admin?situacao=ativo&uf=RS");
  });
});

describe("cidade e UF no painel (backend #184)", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it("não volta a partir o emoji ao enviar a busca de 100 caracteres para o backend", async () => {
    chamarBackend.mockResolvedValue({ total: 0, limit: 20, offset: 0, itens: [] });
    const busca = "x".repeat(99) + "😀";
    await listarContas({ busca });
    expect(new URL(chamarBackend.mock.calls[0][0], "https://ledgr.test").searchParams.get("busca")).toBe(busca);
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO } from "@/lib/demo";
import type { Papel } from "@/lib/papel";
import { urlDeCheckoutValida } from "@/lib/assinatura";
import { carregarPrecos, iniciarCheckout } from "./acoes";

// a rede é a fronteira; ErroBackend e a tradução dos erros rodam de verdade
const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));
const conta = vi.hoisted(() => ({ papel: "admin" as Papel }));
vi.mock("../../../../(auth)/acoes", () => ({ contaDaSessao: async () => ({ papel: conta.papel }) }));

const STRIPE = "https://checkout.stripe.com/c/pay/cs_test_123";

beforeEach(() => {
  chamarBackend.mockReset();
  emailDaSessao.mockResolvedValue("ana@x.com");
  conta.papel = "admin";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("carregarPrecos", () => {
  it("lê a rota pública e adapta", async () => {
    chamarBackend.mockResolvedValueOnce([{ plano: "essencial", periodo: "mensal", valor_centavos: 14900, moeda: "brl" }]);
    expect(await carregarPrecos()).toEqual([
      { plano: "essencial", periodo: "mensal", centavos: 14900, valor: "R$ 149,00", porMes: null, desconto: null },
    ]);
    expect(chamarBackend).toHaveBeenCalledWith("/assinatura/precos", { publica: true });
  });

  it("com a cobrança desligada (503) ou qualquer falha, devolve null", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(503, "Cobrança indisponível."));
    expect(await carregarPrecos()).toBeNull();
    chamarBackend.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await carregarPrecos()).toBeNull();
  });
});

describe("iniciarCheckout", () => {
  it("pede a sessão de checkout com o plano e o período e devolve a url", async () => {
    chamarBackend.mockResolvedValueOnce({ url: STRIPE });
    expect(await iniciarCheckout("padrao", "anual")).toEqual({ ok: true, dados: { url: STRIPE } });
    expect(chamarBackend).toHaveBeenCalledWith("/assinatura/checkout", { method: "POST", corpo: { plano: "padrao", periodo: "anual" } });
  });

  it("recusa plano ou período fora da lista sem chamar o backend", async () => {
    const recusa = { ok: false, status: 422, erro: "Esse plano não está disponível." };
    expect(await iniciarCheckout("volume" as never, "mensal")).toEqual(recusa);
    expect(await iniciarCheckout("padrao", "bienal" as never)).toEqual(recusa);
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("só o administrador assina, e a demonstração não assina", async () => {
    conta.papel = "gestor";
    expect(await iniciarCheckout("padrao", "mensal")).toEqual({ ok: false, status: 403, erro: "Só o administrador da conta assina." });
    conta.papel = "admin";
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.app");
    emailDaSessao.mockResolvedValue("demo@ledgr.app");
    const demo = await iniciarCheckout("padrao", "mensal");
    expect(demo).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
    if (!demo.ok) expect(demo.erro).toBe(RECUSA_DEMONSTRACAO);
  });

  it.each([
    [new ErroBackend(409, "Sua conta já tem uma assinatura."), 409, "Sua conta já tem uma assinatura."],
    [new ErroBackend(503, "Cobrança desligada."), 503, "A assinatura não está disponível agora. Tente de novo mais tarde."],
    [new ErroBackend(429, "Limite.", [], {}, 120), 429, "Muitas tentativas. Tente de novo em 2 minutos."],
    [new ErroBackend(429, "Limite.", [], {}, 30), 429, "Muitas tentativas. Tente de novo em 1 minuto."],
    [new ErroBackend(401, "Sessão expirada."), 401, "Sua sessão expirou. Entre de novo para continuar."],
    [new ErroBackend(403, "Proibido."), 403, "Só o administrador da conta assina."],
    [new ErroBackend(422, "Inválido."), 422, "Esse plano não está disponível."],
    [new TypeError("fetch failed"), 0, "Não foi possível falar com o servidor."],
  ])("traduz o erro %#", async (erro, status, texto) => {
    chamarBackend.mockRejectedValueOnce(erro);
    expect(await iniciarCheckout("padrao", "mensal")).toEqual({ ok: false, status, erro: texto });
  });

  it("não devolve uma url que não seja da Stripe", async () => {
    chamarBackend.mockResolvedValueOnce({ url: "https://evil.example/x" });
    expect(await iniciarCheckout("padrao", "mensal")).toEqual({
      ok: false,
      status: 502,
      erro: "A assinatura não está disponível agora. Tente de novo mais tarde.",
    });
  });
});

describe("urlDeCheckoutValida", () => {
  it("aceita o checkout da Stripe e, fora de produção, a volta do backend-fake", () => {
    expect(urlDeCheckoutValida(STRIPE, true)).toBe(true);
    expect(urlDeCheckoutValida("https://checkout.stripe.com.evil.example/x", true)).toBe(false);
    expect(urlDeCheckoutValida("http://checkout.stripe.com/x", true)).toBe(false);
    expect(urlDeCheckoutValida("/assinatura?checkout=sucesso", true)).toBe(false);
    expect(urlDeCheckoutValida("/assinatura?checkout=sucesso", false)).toBe(true);
    expect(urlDeCheckoutValida("//evil.example/assinatura?checkout=sucesso", false)).toBe(false);
  });
});

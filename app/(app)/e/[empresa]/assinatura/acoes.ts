"use server";

import { adaptarPrecos, PERIODOS, urlDeCheckoutValida, type Periodo, type PlanoId, type PrecoDoPlano } from "@/lib/assinatura";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { contaDaSessao } from "../../../../(auth)/acoes";
import { ehAdmin, recusaPorPapel } from "@/lib/papel";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * A assinatura pela Stripe (backend #180, spec 2026-10-31-assinatura-pela-stripe). Os preços são
 * públicos e vêm do catálogo da Stripe; o checkout é só do admin e devolve a página de pagamento. Nada
 * aqui libera acesso: a situação da conta só muda pelo `GET /me`, que só muda pelo webhook.
 */

const PLANOS: PlanoId[] = ["essencial", "padrao", "avancado"];
const SO_ADMIN = "Só o administrador da conta assina.";
const INDISPONIVEL = "A assinatura não está disponível agora. Tente de novo mais tarde.";
const PLANO_INDISPONIVEL = "Esse plano não está disponível.";

/** Null com a cobrança desligada (503), sem catálogo (502) ou com o backend fora: a tela mostra os preços de referência. */
export async function carregarPrecos(): Promise<PrecoDoPlano[] | null> {
  try {
    return adaptarPrecos(await chamarBackend<unknown>("/assinatura/precos", { publica: true }));
  } catch {
    return null;
  }
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 403) return { ok: false, status, erro: SO_ADMIN };
  if (status === 422) return { ok: false, status, erro: PLANO_INDISPONIVEL };
  if (status === 503) return { ok: false, status, erro: INDISPONIVEL };
  if (status === 429) {
    const minutos = Math.max(1, Math.ceil((erro.segundosParaTentar ?? 60) / 60));
    return { ok: false, status, erro: `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.` };
  }
  // o 409 (já assina) chega com o texto do backend, que já explica
  return { ok: false, status, erro: erro.detalhe };
}

export async function iniciarCheckout(plano: PlanoId, periodo: Periodo): Promise<Resultado<{ url: string }>> {
  // Server Action é endpoint público: o que chega pode ser qualquer coisa
  if (!PLANOS.includes(plano) || !PERIODOS.includes(periodo)) return { ok: false, status: 422, erro: PLANO_INDISPONIVEL };
  const porPapel = recusaPorPapel(await contaDaSessao(), ehAdmin, SO_ADMIN);
  if (porPapel) return porPapel;
  if (ehContaDeDemonstracao(await emailDaSessao())) return { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO };
  try {
    const { url } = await chamarBackend<{ url: string }>("/assinatura/checkout", { method: "POST", corpo: { plano, periodo } });
    if (typeof url !== "string" || !urlDeCheckoutValida(url, process.env.NODE_ENV === "production")) {
      return { ok: false, status: 502, erro: INDISPONIVEL };
    }
    return { ok: true, dados: { url } };
  } catch (erro) {
    return traduzir(erro);
  }
}

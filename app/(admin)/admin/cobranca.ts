/** Rótulos e formatos da cobrança no painel interno (#236, backend #169/PR #182). Puro, para o teste. */

export const ROTULO_DO_PAGAMENTO: Record<string, string> = { paga: "Paga", falhou: "Falhou" };

export const ROTULO_DA_ORIGEM: Record<string, string> = {
  cliente: "Cliente",
  falta_de_pagamento: "Falta de pagamento",
  operador: "Operador",
  painel_stripe: "Painel da Stripe",
};

/** O `status` da assinatura na Stripe. */
export const ROTULO_DO_STATUS: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Pagamento atrasado",
  canceled: "Cancelada",
  unpaid: "Não paga",
  incomplete: "Incompleta",
  incomplete_expired: "Incompleta expirada",
  paused: "Pausada",
};

export const ROTULO_DO_PERIODO: Record<string, string> = {
  mensal: "mensal",
  trimestral: "trimestral",
  semestral: "semestral",
  anual: "anual",
};

/** Os prazos oferecidos na tela de vencimentos (o backend aceita de 1 a 60 dias). */
export const PRAZOS_DE_VENCIMENTO = [7, 15, 30, 60] as const;

/** A Stripe manda centavos e a moeda em minúsculas ("brl"). */
export function formatarValor(centavos: number, moeda: string): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: moeda.toUpperCase() });
}

/** Uma data "AAAA-MM-DD" de `<input type="date">`, ou nada: o resto não vai ao backend. */
export function dataDoFiltro(valor: string | undefined): string | undefined {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : undefined;
}

/** O endereço de uma lista do painel com os filtros preenchidos e a página (a 1 fica de fora). */
export function enderecoDaLista(base: string, filtros: Record<string, string | undefined>, pagina: number): string {
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) if (valor && chave !== "pagina") q.set(chave, valor);
  if (pagina > 1) q.set("pagina", String(pagina));
  const texto = q.toString();
  return texto ? `${base}?${texto}` : base;
}

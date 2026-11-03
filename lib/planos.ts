/**
 * Os planos e as faixas. Sem preço de propósito: o preço que vale é o da Stripe,
 * em `GET /assinatura/precos` (`carregarPrecos`); sem ele, nenhuma tela de
 * cobrança mostra valor (#296).
 */

export type Plano = {
  nome: string;
  limite: string;
  /** O número grande da régua de planos da landing: o teto do plano, ou o piso com "+" no aberto. */
  volume: string;
  /** O plano em evidência na landing. */
  destaque: boolean;
  /** Sem preço de tabela: fala com a gente. */
  contato: boolean;
};

export const PLANOS: Plano[] = [
  { nome: "Essencial", limite: "até 100 lançamentos por mês", volume: "100", destaque: false, contato: false },
  { nome: "Padrão", limite: "até 200 lançamentos por mês", volume: "200", destaque: true, contato: false },
  { nome: "Avançado", limite: "até 350 lançamentos por mês", volume: "350", destaque: false, contato: false },
  { nome: "Escala", limite: "até 5.000 lançamentos por mês", volume: "5.000", destaque: false, contato: false },
  {
    nome: "Volume",
    limite: "acima de 5.000, para indústria e multi-banco",
    volume: "5.000+",
    destaque: false,
    contato: true,
  },
];

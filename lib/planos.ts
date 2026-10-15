/**
 * Os planos e preços que a landing anuncia. A tela de assinatura lê a mesma
 * lista: o preço que o visitante vê antes de assinar é o que aparece no app
 * depois. Mudou preço ou faixa, muda aqui e as duas telas acompanham.
 */

export type Plano = {
  nome: string;
  preco: string;
  limite: string;
  /** O número grande da régua de planos da landing: o teto do plano, ou o piso com "+" no aberto. */
  volume: string;
  /** O plano em evidência na landing. */
  destaque: boolean;
  /** Sem preço de tabela: fala com a gente. */
  contato: boolean;
};

export const PLANOS: Plano[] = [
  { nome: "Essencial", preco: "R$ 49,90", limite: "até 100 lançamentos por mês", volume: "100", destaque: false, contato: false },
  { nome: "Padrão", preco: "R$ 79,90", limite: "até 200 lançamentos por mês", volume: "200", destaque: true, contato: false },
  { nome: "Avançado", preco: "R$ 99,90", limite: "até 350 lançamentos por mês", volume: "350", destaque: false, contato: false },
  { nome: "Escala", preco: "R$ 149,90", limite: "até 5.000 lançamentos por mês", volume: "5.000", destaque: false, contato: false },
  {
    nome: "Volume",
    preco: "Sob consulta",
    limite: "acima de 5.000, para indústria e multi-banco",
    volume: "5.000+",
    destaque: false,
    contato: true,
  },
];

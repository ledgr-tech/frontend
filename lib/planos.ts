/**
 * Os planos e preços que a landing anuncia. A tela de assinatura lê a mesma
 * lista: o preço que o visitante vê antes de assinar é o que aparece no app
 * depois. Mudou preço ou faixa, muda aqui e as duas telas acompanham.
 */

export type Plano = {
  nome: string;
  preco: string;
  limite: string;
  /** O plano em evidência na landing. */
  destaque: boolean;
  /** Sem preço de tabela: fala com a gente. */
  contato: boolean;
};

export const PLANOS: Plano[] = [
  { nome: "Essencial", preco: "R$ 49,90", limite: "até 100 lançamentos por mês", destaque: false, contato: false },
  { nome: "Padrão", preco: "R$ 79,90", limite: "até 200 lançamentos por mês", destaque: true, contato: false },
  { nome: "Avançado", preco: "R$ 99,90", limite: "até 350 lançamentos por mês", destaque: false, contato: false },
  { nome: "Escala", preco: "R$ 149,90", limite: "até 5.000 lançamentos por mês", destaque: false, contato: false },
  {
    nome: "Volume",
    preco: "Sob consulta",
    limite: "acima de 5.000 — indústria e multi-banco",
    destaque: false,
    contato: true,
  },
];

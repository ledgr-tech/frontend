/**
 * Os planos e as faixas. Sem preço nem franquia de propósito: os dois vêm de
 * `GET /assinatura/precos` (`carregarPrecos`); sem eles, nenhuma tela de
 * cobrança mostra valor (#296) nem limite (#297).
 */

export type Plano = {
  nome: string;
  /** Só o plano sob consulta, que não tem franquia para mostrar. */
  descricao?: string;
  /** O número grande da régua de planos da landing: o teto do plano, ou o piso com "+" no aberto. */
  volume: string;
  /** O plano em evidência na landing. */
  destaque: boolean;
  /** Sem preço de tabela: fala com a gente. */
  contato: boolean;
};

export const PLANOS: Plano[] = [
  { nome: "Essencial", volume: "100", destaque: false, contato: false },
  { nome: "Padrão", volume: "200", destaque: true, contato: false },
  { nome: "Avançado", volume: "350", destaque: false, contato: false },
  { nome: "Escala", volume: "5.000", destaque: false, contato: false },
  {
    nome: "Volume",
    descricao: "para indústria e multi-banco",
    volume: "5.000+",
    destaque: false,
    contato: true,
  },
];

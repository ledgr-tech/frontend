import { EMPRESA_MOCK } from "@/lib/mock-data";
import { PLANOS, type Plano } from "@/lib/planos";

/**
 * A assinatura da empresa de demonstração, com os números do design
 * (assinaturaNums e faturas em Ledgr.dc.html).
 *
 * ponytail: o backend não tem cobrança nenhuma. Falta ler a assinatura (plano,
 * data de renovação, forma de pagamento), listar as faturas com o PDF do
 * recibo, e as três escritas: trocar de plano, trocar a forma de pagamento e
 * cancelar. Quando existirem, este arquivo vira a leitura desses endpoints no
 * servidor, como `listarExecucoes` em `conciliacoes/acoes.ts`, e os botões da
 * tela deixam de nascer desligados.
 */

function plano(nome: string): Plano {
  const encontrado = PLANOS.find((p) => p.nome === nome);
  if (!encontrado) throw new Error(`Plano "${nome}" não está em lib/planos.ts`);
  return encontrado;
}

// O design põe a empresa no "Volume, acima de 350 lançamentos" — a faixa de
// antes de a landing criar o Escala. Pela landing, 4.218 lançamentos em
// setembro cabem no Escala, e o Volume começa acima de 5.000.
const ATUAL = plano("Escala");
const ANTERIOR = plano("Avançado");

export const ASSINATURA = {
  plano: ATUAL,
  renovaEm: "12 de outubro",
  /** O porquê desta faixa, no cartão do plano atual. */
  faixa: `É a faixa da ${EMPRESA_MOCK}: 4.218 lançamentos em setembro, quatro bancos.`,
};

export const NUMEROS = [
  { rotulo: "Plano atual", valor: ATUAL.nome, nota: `${ATUAL.preco} · ${ATUAL.limite}` },
  { rotulo: "Contas conciliadas", valor: "4", nota: "Sicredi, Sicoob, Itaú e Banco do Brasil" },
  { rotulo: "Lançamentos em setembro", valor: "4.218", nota: "Conferidos contra o razão do Cigam" },
];

export type Fatura = {
  competencia: string;
  vencimento: string;
  valor: string;
  situacao: "Paga" | "A vencer";
};

// Da mais nova para a mais antiga. O valor é o preço do plano de cada mês: o
// design cobrava R$ 249,00, que não é preço de plano nenhum na landing.
export const FATURAS: Fatura[] = [
  { competencia: "Outubro de 2026", vencimento: "12 de outubro", valor: ATUAL.preco, situacao: "A vencer" },
  { competencia: "Setembro de 2026", vencimento: "12 de setembro", valor: ATUAL.preco, situacao: "Paga" },
  { competencia: "Agosto de 2026", vencimento: "12 de agosto", valor: ATUAL.preco, situacao: "Paga" },
  { competencia: "Julho de 2026", vencimento: "12 de julho", valor: ANTERIOR.preco, situacao: "Paga" },
];

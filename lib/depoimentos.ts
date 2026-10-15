/**
 * Os depoimentos da landing (app/(marketing)/depoimentos.tsx). Só entra em DEPOIMENTOS quem existe
 * e autorizou aparecer no site: depoimento inventado é publicidade enganosa (CDC, art. 37, e o
 * Código do CONAR). Com a lista vazia a seção não aparece no site publicado, e a landing fica como
 * estava.
 */

export type Depoimento = {
  /** A frase, como a pessoa disse (sem as aspas: o card desenha as dele). */
  citacao: string;
  nome: string;
  cargo: string;
  /** Sem empresa (um contador autônomo, por exemplo), a assinatura fica só com o cargo. */
  empresa?: string;
  /** A nota que a pessoa deu, de 1 a 5. Sem nota, o card fica sem estrelas: estrela só de nota real. */
  nota?: number;
};

export const DEPOIMENTOS: Depoimento[] = [];

/**
 * Exemplos para ver a seção montada enquanto os reais não chegam. Pessoas e empresas fictícias: o
 * primeiro é o do export do Claude Design, os outros no mesmo tom. Nunca vão ao site de produção
 * (ver `depoimentosDaLanding`), e saem daqui quando DEPOIMENTOS tiver os de verdade.
 */
export const DEPOIMENTOS_DE_EXEMPLO: Depoimento[] = [
  {
    citacao:
      "Setembro fechou numa quinta à tarde, não no domingo de madrugada. A conferência que levava três dias virou a revisão de vinte e sete linhas.",
    nome: "Marina Setúbal",
    cargo: "Responsável financeira",
    empresa: "Padaria Aurora",
    nota: 5,
  },
  {
    citacao:
      "Atendo onze empresas. Cada extrato era uma planilha nova e uma tarde de olho cansado. Agora abro o Ledgr e vejo só o que não bateu.",
    nome: "Carlos Menezes",
    cargo: "Contador",
    nota: 5,
  },
  {
    citacao:
      "A tarifa que o banco cobrava duas vezes passava batido todo mês. Na primeira conciliação ela já veio marcada.",
    nome: "Juliana Prado",
    cargo: "Analista financeira",
    empresa: "Distribuidora Vale Verde",
    nota: 4,
  },
  {
    citacao: "Não troquei de sistema nem de banco. Subo os dois extratos e em dez minutos sei o que corrigir no ERP.",
    nome: "Rafael Antunes",
    cargo: "Sócio-administrador",
    empresa: "Oficina Antunes",
  },
  {
    citacao:
      "O que mais ajudou foi saber por que cada linha não bate. A explicação já vem pronta para mandar ao contador.",
    nome: "Beatriz Lacerda",
    cargo: "Assistente administrativa",
    empresa: "Clínica Bem Viver",
  },
];

/**
 * O que a landing mostra. Havendo depoimento real, só os reais. Sem eles, os de exemplo aparecem
 * fora da produção: sozinhos no preview da Vercel, e no local com LEDGR_DEPOIMENTOS_EXEMPLO=1. No
 * deploy de produção (VERCEL_ENV=production) nunca, nem com a variável ligada por engano.
 *
 * A landing é estática: isto roda no build, e trocar a variável pede um deploy novo.
 */
export function depoimentosDaLanding(
  reais: Depoimento[] = DEPOIMENTOS,
  ambiente: Record<string, string | undefined> = process.env,
): Depoimento[] {
  if (reais.length > 0) return reais;
  if (ambiente.VERCEL_ENV === "production") return [];
  const exemplos = ambiente.VERCEL_ENV === "preview" || ambiente.LEDGR_DEPOIMENTOS_EXEMPLO === "1";
  return exemplos ? DEPOIMENTOS_DE_EXEMPLO : [];
}

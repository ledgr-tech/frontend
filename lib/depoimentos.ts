/**
 * Os depoimentos da landing (app/(marketing)/depoimentos.tsx). Só entra aqui quem existe e
 * autorizou aparecer no site: depoimento inventado é publicidade enganosa (CDC, art. 37, e o Código
 * do CONAR). Com a lista vazia a seção não aparece, e a landing fica como estava.
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

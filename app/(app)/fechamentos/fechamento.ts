import type { Execucao } from "@/lib/adaptadores";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type Competencia = {
  /** "setembro": o mês que está fechando. */
  mes: string;
  /** "outubro": o que o botão de começar abre. */
  proximo: string;
};

/**
 * O mês da conciliação, a partir do `mes` que `adaptarConciliacao` já monta
 * ("Setembro/2026"): lendo dali, o título desta tela e a competência da visão
 * geral nunca discordam. Null quando nenhuma linha tinha data e o adaptador pôs
 * outra coisa no lugar.
 */
export function competencia(mes: string): Competencia | null {
  const indice = MESES.indexOf(mes.split("/")[0].toLowerCase());
  if (indice === -1) return null;
  return { mes: MESES[indice], proximo: MESES[(indice + 1) % 12] };
}

// O servidor da Vercel roda em UTC; uma execução de 31/03 à noite em Brasília
// sairia como abril.
const MES_E_ANO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  month: "long",
  year: "numeric",
});

export type PrimeiraConciliacao = {
  /** "Março de 2026", como no marco do design. */
  quando: string;
  lancamentos: number;
};

/**
 * A execução mais antiga, para o marco "Primeira conciliação". A lista chega da
 * mais recente para a mais antiga e só com a primeira página: se o total passa
 * dela, a última da lista não é a primeira de todas, e aí não há o que dizer.
 */
export function primeiraConciliacao(
  execucoes: Execucao[],
  total: number,
): PrimeiraConciliacao | null {
  const primeira = execucoes.at(-1);
  if (!primeira || total > execucoes.length) return null;
  const quando = MES_E_ANO.format(new Date(primeira.executadaEm));
  return {
    quando: quando.charAt(0).toUpperCase() + quando.slice(1),
    lancamentos: primeira.lancamentos,
  };
}

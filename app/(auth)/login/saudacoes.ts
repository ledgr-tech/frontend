// Mensagens de boas-vindas da tela de login — neutras em gênero, uma por visita.
export const SAUDACOES: readonly string[] = [
  "Bom ver você de novo.",
  "Que bom ter você aqui.",
  "Vamos fechar o mês?",
  "O fechamento começa aqui.",
  "Hora de conferir os lançamentos.",
  "Tudo pronto para conciliar.",
];

export const CHAVE_SAUDACAO = "ledgr_login_saudacao";

/** Sorteia o índice da próxima saudação, sem repetir a da visita anterior. */
export function escolherSaudacao(anterior: number | null, sortear: () => number = Math.random): number {
  const anteriorValida =
    anterior !== null && Number.isInteger(anterior) && anterior >= 0 && anterior < SAUDACOES.length ? anterior : null;
  const opcoes = SAUDACOES.map((_, indice) => indice).filter((indice) => indice !== anteriorValida);
  return opcoes[Math.min(Math.floor(sortear() * opcoes.length), opcoes.length - 1)];
}

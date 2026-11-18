// As perguntas escondidas fazem parte da backend #225, mas o PR 1 (backend #227) ainda não entrou.
// Quando uma ferramenta sair no backend, basta tirar o `requer` das perguntas que ela responde.
// O texto é o da #225, com o mês dito na 10 e na 13: toda ferramenta pede a competência, e sem o mês a IA
// pergunta ou adivinha.
export type Tema = "visao-do-mes" | "divergencias" | "lancamentos" | "fechamento" | "resumo";
export type OpcaoDaConexao = "descricoes";
export type PerguntaSugerida = {
  id: string;
  tema: Tema;
  texto: string;
  requer?: { ferramenta: string } | { opcao: OpcaoDaConexao };
};

export const TEMAS: { id: Tema; titulo: string }[] = [
  { id: "visao-do-mes", titulo: "Visão do mês" },
  { id: "divergencias", titulo: "Divergências" },
  { id: "lancamentos", titulo: "Lançamentos" },
  { id: "fechamento", titulo: "Fechamento" },
  { id: "resumo", titulo: "Resumo" },
];

export const PERGUNTAS: PerguntaSugerida[] = [
  { id: "1", tema: "visao-do-mes", texto: "Como foi a conciliação de outubro?" },
  { id: "2", tema: "visao-do-mes", texto: "Quanto entrou e quanto saiu em outubro, no banco e no sistema, e qual a diferença?", requer: { ferramenta: "visao_do_mes" } },
  { id: "3", tema: "visao-do-mes", texto: "O saldo final do extrato de outubro bate com o do sistema?", requer: { ferramenta: "visao_do_mes" } },
  { id: "4", tema: "visao-do-mes", texto: "Como outubro se compara com setembro?" },
  { id: "5", tema: "visao-do-mes", texto: "Como evoluíram as divergências nos últimos seis meses?" },
  { id: "6", tema: "divergencias", texto: "Quais são as dez maiores divergências do mês?", requer: { ferramenta: "divergencias_ordenadas" } },
  { id: "7", tema: "divergencias", texto: "Quais divergências de valor passam de R$ 1.000?", requer: { ferramenta: "divergencias_ordenadas" } },
  { id: "8", tema: "divergencias", texto: "Quais ainda não foram justificadas? O que está aguardando aprovação?" },
  { id: "9", tema: "divergencias", texto: "Por que essa divergência de R$ 350,00 aconteceu?", requer: { ferramenta: "detalhe_da_divergencia" } },
  { id: "10", tema: "divergencias", texto: "Quanto foi de tarifa bancária em outubro? Há pagamentos duplicados?" },
  { id: "11", tema: "divergencias", texto: "Quais lançamentos foram conciliados por agrupamento e como a soma foi formada?", requer: { ferramenta: "grupos_do_mes" } },
  { id: "12", tema: "lancamentos", texto: "Existe um lançamento de R$ 1.250,00 em outubro? Foi conciliado?", requer: { ferramenta: "lancamentos_do_mes" } },
  { id: "13", tema: "lancamentos", texto: "Quais lançamentos do banco no dia 12 de outubro ficaram sem correspondência?" },
  { id: "14", tema: "lancamentos", texto: "Liste os débitos acima de R$ 5.000 do mês.", requer: { ferramenta: "lancamentos_do_mes" } },
  { id: "15", tema: "fechamento", texto: "Outubro pode ser fechado? O que falta?" },
  { id: "16", tema: "fechamento", texto: "Quais meses ainda não foram fechados? Quando foi fechado setembro?" },
  { id: "17", tema: "resumo", texto: "Faça um resumo do fechamento de outubro para eu mandar ao cliente." },
];

export function perguntasDisponiveis(opcoesLigadas: readonly OpcaoDaConexao[] = []) {
  return TEMAS.map(({ id: tema, titulo }) => ({
    tema,
    titulo,
    perguntas: PERGUNTAS.filter((pergunta) => {
      if (pergunta.tema !== tema) return false;
      if (!pergunta.requer) return true;
      return "opcao" in pergunta.requer && opcoesLigadas.includes(pergunta.requer.opcao);
    }),
  })).filter((grupo) => grupo.perguntas.length > 0);
}

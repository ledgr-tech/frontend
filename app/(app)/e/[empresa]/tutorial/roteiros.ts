import type { TelaDoTutorial } from "@/lib/preferencias";

/**
 * O tutorial de cada tela, apresentado pelo mascote (spec 2026-10-15-primeiro-uso, parte 3).
 * `alvo` é o `data-tutorial` do elemento que o passo destaca; o passo só entra no tutorial quando
 * o alvo está na tela (o roteiro dispensado, a conta sem conciliação). Numa tela vazia, o "?" mostra
 * todos, sem destaque. Rascunho: o texto final passa pela revisão dos sócios.
 */
export type PassoDoTutorial = {
  alvo: string;
  titulo: string;
  texto: string;
};
export type TutorialDaTela = { nome: string; mascote: string; passos: PassoDoTutorial[] };

export const TUTORIAIS: Record<TelaDoTutorial, TutorialDaTela> = {
  "visao-geral": {
    nome: "Visão geral",
    mascote: "/mascotes/mascote-apresenta.png",
    passos: [
      { alvo: "roteiro", titulo: "Este é o seu roteiro.", texto: "Cada passo se marca sozinho quando você faz. Comece pela tolerância de dias: ela diz quantos dias de diferença entre o banco e o sistema ainda contam como bateu." },
      { alvo: "estado-do-mes", titulo: "O mês em um número.", texto: "Quantos lançamentos do mês aberto já bateram e quanto ainda está em aberto." },
      { alvo: "atalhos", titulo: "Atalhos para o resto.", texto: "Extratos, conciliações, fechamentos e histórico, com o que mudou desde a última vez." },
    ],
  },
  conciliacoes: {
    nome: "Conciliações",
    mascote: "/mascotes/mascote-caminhando.png",
    passos: [
      { alvo: "filtros", titulo: "Filtre a fila.", texto: "Veja só o que pede decisão, o que já está sem pendência ou os meses fechados." },
      { alvo: "lista", titulo: "Sua fila de conciliações.", texto: "Cada par de folhas é um extrato do banco com o do sistema, na rodada que vale, agrupado pelo mês. Um clique mostra o resumo ao lado; dois abrem a comparação." },
      { alvo: "previa", titulo: "A conciliação escolhida.", texto: "A primeira que ainda pede decisão já vem aberta aqui: quanto bate, o que falta, a rodada e o mês. Clique em Abrir a comparação para continuar de onde parou." },
    ],
  },
  "nova-conciliacao": {
    nome: "Nova conciliação",
    mascote: "/mascotes/mascote-joinha.png",
    passos: [
      { alvo: "encaixe", titulo: "Encaixe os dois extratos.", texto: "O do banco vai à esquerda e o do sistema de gestão à direita, do mesmo período." },
      { alvo: "conciliar", titulo: "Concilie.", texto: "Com os dois arquivos, o botão libera. A comparação abre sozinha quando terminar." },
    ],
  },
  comparacao: {
    nome: "Comparação",
    mascote: "/mascotes/mascote-lupa.png",
    passos: [
      { alvo: "rodadas", titulo: "As rodadas até o fechamento.", texto: "Cada número é um extrato do sistema conciliado com este do banco; o escuro é o que está na tela. Clique num para abrir aquela rodada. A bandeira leva ao fechamento e diz quanto falta." },
      { alvo: "resumo", titulo: "O resumo antes da lista.", texto: "Cada categoria diz quantos lançamentos caíram nela e quanto valem. Clique numa para ver só essas linhas." },
      { alvo: "filtros", titulo: "Escolha o que ver.", texto: "Os filtros mostram tudo, só o que pede decisão ou só o que já bateu." },
      { alvo: "conferida", titulo: "Marque o que você já olhou.", texto: "A coluna Conferida é sua: marque as divergências que já conferiu. As que bateram não precisam." },
    ],
  },
  divergencia: {
    nome: "Divergência",
    mascote: "/mascotes/mascote-lupa.png",
    passos: [
      { alvo: "lados", titulo: "Banco de um lado, sistema do outro.", texto: "A diferença aparece entre os dois. É o sistema que diverge do banco, nunca o contrário." },
      { alvo: "causa", titulo: "O provável motivo.", texto: "Confira o motivo e decida: marque como conferida ou justifique. A decisão vai para o fechamento." },
    ],
  },
  extratos: {
    nome: "Extratos",
    mascote: "/mascotes/mascote-explicando.png",
    passos: [
      { alvo: "filtros", titulo: "Separe o banco do sistema.", texto: "Os filtros mostram só os arquivos do banco, só os do sistema ou os que tiveram problema na leitura." },
      { alvo: "arquivos", titulo: "Todos os arquivos que você enviou.", texto: "Agrupados pelo mês do extrato. Clique num arquivo para ver os detalhes ao lado." },
      { alvo: "painel", titulo: "O que aconteceu com o arquivo.", texto: "Quantas linhas foram lidas, quando foi conciliado e o atalho para a conciliação dele." },
    ],
  },
  historico: {
    nome: "Histórico",
    mascote: "/mascotes/mascote-sentado.png",
    passos: [
      { alvo: "grafico", titulo: "Como os meses andaram.", texto: "O gráfico mostra quanto bateu em cada mês." },
      { alvo: "lista", titulo: "Tudo o que foi conciliado.", texto: "Cada conciliação é um par de folhas, agrupadas pelo mês do extrato. Clique numa para ver os detalhes ao lado; dois cliques abrem a comparação." },
      { alvo: "previa", titulo: "As rodadas de cada conciliação.", texto: "Ao lado, o que bateu na rodada que vale e cada execução que ela teve, com as anteriores e as refeitas." },
    ],
  },
  fechamentos: {
    nome: "Fechamentos",
    mascote: "/mascotes/mascote-comemorando.png",
    passos: [
      { alvo: "meses", titulo: "Um cartão por mês.", texto: "A cor e a porcentagem mostram o que já bateu. Escolha o mês que quer fechar." },
      { alvo: "painel", titulo: "O que falta para fechar.", texto: "Os passos que faltam, o relatório em PDF e o botão de fechar o mês aparecem aqui." },
    ],
  },
  configuracoes: {
    nome: "Configurações",
    mascote: "/mascotes/mascote-apresenta.png",
    passos: [
      { alvo: "tolerancia", titulo: "A sua regra da conciliação.", texto: "A tolerância diz quantos dias de diferença entre o banco e o sistema, para mais ou para menos, ainda contam como bateu. Vale a partir da próxima conciliação." },
      { alvo: "fonte-da-verdade", titulo: "O banco é a referência.", texto: "Toda divergência aparece como o sistema divergindo do banco. É no sistema que se corrige." },
    ],
  },
};

/** A tela do tutorial pelo endereço; null onde não há tutorial (relatório, assinatura, 404). */
export function telaDoCaminho(caminho: string): TelaDoTutorial | null {
  const partes = caminho.split("/").filter(Boolean);
  if (partes[0] === "visao-geral") return "visao-geral";
  if (partes[0] === "dashboard") return "conciliacoes";
  if (partes[0] === "extratos") return "extratos";
  if (partes[0] === "historico") return "historico";
  if (partes[0] === "fechamentos" && partes.length === 1) return "fechamentos";
  if (partes[0] === "conciliacoes") {
    if (partes[1] === "nova") return "nova-conciliacao";
    if (partes.length === 2) return "comparacao";
    if (partes.length === 3) return "divergencia";
  }
  return null;
}

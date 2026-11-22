import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { VisaoGeral } from "../conciliacoes/acoes";
import {
  formatarInteiro,
  formatarMoedaCurta,
  formatarPercentual,
  pedeDecisao,
  resumir,
  statusDaLinha,
  valorEmAberto,
} from "../dashboard/resumo";
import { pendencias, type Pendencia } from "../visao-geral/pendencias";

/**
 * Roteiro de reserva: a conciliação mais recente, lida do backend. Responde quando
 * o assistente não cobre a pergunta ou está indisponível, inclusive na demonstração.
 * O pedido de explicação continua neste roteiro, pela IA de `POST /explicacoes`.
 */

export type Contexto = {
  /** "setembro", para o meio da frase; "Setembro", para abrir. */
  mes: string;
  Mes: string;
  processados: number;
  batidos: number;
  taxa: number;
  divergentes: number;
  fechado?: boolean;
  valorAberto: number;
  grupos: Pendencia[];
  naoLidas: { nome: string; linhas: number }[];
  /** A conciliação inteira, para "abrir a lista". */
  caminho: string;
  /** A divergência que mais deixa dinheiro em aberto: a que "explique" explica. */
  maior: { id: string; descricao: string; rotulo: string; valor: number; href: string } | null;
};

export function montarContexto(visao: VisaoGeral): Contexto | null {
  if (!visao.recente) return null;
  const { conciliacao } = visao.recente;
  const resumo = resumir([conciliacao]);
  const Mes = conciliacao.mes.split("/")[0];

  // a justificada já tem o porquê: não é "a maior divergência" a explicar
  const emAberto = conciliacao.linhas.filter(pedeDecisao);
  const maior = emAberto.reduce<(typeof emAberto)[number] | null>(
    (atual, linha) => (atual === null || valorEmAberto([linha]) > valorEmAberto([atual]) ? linha : atual),
    null,
  );

  return {
    mes: Mes.toLowerCase(),
    Mes,
    processados: resumo.processados,
    batidos: resumo.batidos,
    taxa: resumo.taxaMatch,
    divergentes: resumo.divergentes,
    fechado: visao.mes?.fechado,
    valorAberto: resumo.valorDivergente,
    grupos: pendencias(conciliacao),
    naoLidas: visao.arquivosComLinhasNaoLidas,
    caminho: caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId),
    maior: maior && {
      id: maior.id,
      descricao: maior.descricao,
      rotulo: statusDaLinha(maior).rotulo,
      valor: valorEmAberto([maior]),
      href: caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId, maior.id),
    },
  };
}

export type Resposta = {
  texto: string;
  link?: { href: string; rotulo: string };
  /** Pede a explicação da maior divergência à IA, em vez de responder daqui. */
  explicar?: true;
};

function plural(quantidade: number, singular: string, plural: string): string {
  return `${formatarInteiro(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

/** "a; b e c": os itens já têm vírgula dentro, no valor em reais. */
function lista(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join("; ")} e ${itens.at(-1)}`;
}

function naoLidas(contexto: Contexto): string {
  return contexto.naoLidas
    .map((arquivo) => ` Atenção: ${plural(arquivo.linhas, "linha", "linhas")} de ${arquivo.nome} não foram lidas e ficaram fora da conta.`)
    .join("");
}

function grupo(contexto: Contexto, rotulo: string): Pendencia | undefined {
  return contexto.grupos.find((item) => item.rotulo === rotulo);
}

/** Sem acento e em minúsculas: "divergência" e "divergencia" são a mesma pergunta. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function pedePassosParaFechar(pergunta: string): boolean {
  return /^(?:como|onde)\b.*\b(?:fech[oa]r?|encerr[oa]r?)\b.*\bmes\b/.test(normalizar(pergunta));
}

export function assuntoDoMes(pergunta: string, mes?: string) {
  const texto = normalizar(pergunta);
  if (/\b(explic|maior)/.test(texto)) return "explicar";
  if (/\btarifa/.test(texto)) return "tarifas";
  if (/\bduplic/.test(texto)) return "duplicidades";
  if (/\b(falta|fech)/.test(texto)) return "fechamento";
  // No começo da palavra: "previsão" não é pergunta sobre revisão.
  if (/\b(sobr|abert|diverg|pendenc|revis)/.test(texto)) return "pendencias";
  if (/\b(resum|como esta|mes\b)/.test(texto) || (mes && texto.includes(mes))) return "resumo";
  // "e agosto?": só o nome de um mês também é pergunta sobre os números, quando há um mês para conferir
  if (mes && perguntaSoDoMes(pergunta)) return "resumo";
  return null;
}

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function mesCitado(pergunta: string): string | undefined {
  // "o Marco", "do Marco": com artigo é gente, não o mês, que vem sem ("em março", "e março?").
  // ponytail: sem artigo ("Marco pode fechar?") ainda vira março; conferir os nomes da equipe resolveria
  const texto = normalizar(pergunta).replace(/\b(?:o|do|ao|pelo|pro)\s+marco\b/g, " ");
  return MESES.find((mes) => new RegExp(`\\b${mes}\\b`).test(texto));
}

/**
 * "setembro", "e agosto?": o nome de um mês com no máximo duas palavras em volta. Uma pergunta de uso
 * que cita um mês ("como envio o extrato de agosto?") ou uma pessoa ("convidar o Marco", "e o Marco?")
 * vai à Central.
 */
export function perguntaSoDoMes(pergunta: string): boolean {
  const citado = mesCitado(pergunta);
  if (!citado) return false;
  const resto = normalizar(pergunta).replace(new RegExp(`\\b${citado}\\b`), " ").match(/[a-z0-9]+/g) ?? [];
  return resto.length <= 2;
}

/**
 * A pergunta sobre os números cita um mês que não é o da conciliação lida: o roteiro só tem a mais
 * recente, então diz isso e aponta onde procurar, em vez de responder sobre o mês errado.
 * Esta proteção continua necessária quando o backend não responde à consulta de outro mês.
 */
function respostaDeOutroMes(pergunta: string, contexto: Contexto): Resposta | null {
  const citado = mesCitado(pergunta);
  if (!citado || citado === normalizar(contexto.mes)) return null;
  const nome = citado === "marco" ? "março" : citado;
  return {
    texto: `Por enquanto eu leio só a conciliação mais recente, a de ${contexto.mes}. Se ${nome} foi conciliado, ele está no Histórico.`,
    link: { href: "/historico", rotulo: "Abrir o Histórico" },
  };
}

/** A primeira mensagem, como a do design: o mês em uma frase. */
export function saudacao(contexto: Contexto): string {
  if (contexto.divergentes === 0) {
    return `${contexto.Mes} está ${formatarPercentual(contexto.taxa)} conciliado. Nenhuma pendência.`;
  }
  const maisComum = [...contexto.grupos].sort((a, b) => b.quantidade - a.quantidade)[0];
  return `${contexto.Mes} está ${formatarPercentual(contexto.taxa)} conciliado. Sobraram ${plural(contexto.divergentes, "pendência", "pendências")}, a maior parte em “${maisComum.rotulo}”.`;
}

/** Os atalhos embaixo da conversa, os do design com os números de agora. */
export function sugestoes(contexto: Contexto): string[] {
  return [
    contexto.valorAberto > 0 ? `Por que sobrou ${formatarMoedaCurta(contexto.valorAberto)}?` : null,
    `Resumo de ${contexto.mes}`,
    "O que falta para fechar?",
    contexto.maior ? "Explique a maior divergência" : null,
  ].filter((item): item is string => item !== null);
}

/**
 * A resposta do roteiro sobre o mês, ou null quando a pergunta não é dele (vai ao assistente da Central).
 * Sobre um mês que não é o do contexto, diz que só lê a conciliação mais recente.
 */
export function responder(pergunta: string, contexto: Contexto, assunto = assuntoDoMes(pergunta, contexto.mes)): Resposta | null {
  if (assunto === null) return null;
  const outroMes = respostaDeOutroMes(pergunta, contexto);
  if (outroMes) return outroMes;
  const { Mes, mes } = contexto;

  if (assunto === "explicar") {
    if (!contexto.maior) return { texto: `Nenhuma divergência em aberto em ${mes}: não há o que explicar.` };
    return { texto: "", explicar: true };
  }

  if (assunto === "tarifas") {
    const tarifas = grupo(contexto, "Tarifa bancária");
    if (!tarifas) return { texto: `Nenhuma tarifa bancária sobrou em ${mes}.` };
    return {
      texto: `${plural(tarifas.quantidade, "tarifa bancária", "tarifas bancárias")} em ${mes}, somando ${formatarMoedaCurta(tarifas.valor)}. Estão no extrato do banco e não no sistema de gestão. É a sobra que o Ledgr já sabe explicar, por isso tem categoria própria.`,
      link: { href: tarifas.href, rotulo: "Ver as tarifas" },
    };
  }

  if (assunto === "duplicidades") {
    const duplicadas = grupo(contexto, "Possível duplicidade");
    if (!duplicadas) return { texto: `Nenhuma possível duplicidade em ${mes}.` };
    return {
      texto: `${plural(duplicadas.quantidade, "possível duplicidade", "possíveis duplicidades")} em ${mes}. É o lançamento que sobrou de um grupo que já formou par: pagamento repetido custa caro, vale conferir primeiro.`,
      link: { href: duplicadas.href, rotulo: "Ver as duplicidades" },
    };
  }

  if (assunto === "fechamento") {
    if (contexto.fechado) return { texto: "Mês fechado.", link: { href: "/fechamentos", rotulo: "Ir aos fechamentos" } };
    if (contexto.divergentes === 0 && contexto.naoLidas.length === 0) {
      return { texto: `Nada: ${mes} está pronto para fechar.`, link: { href: "/fechamentos", rotulo: "Ir aos fechamentos" } };
    }
    if (contexto.divergentes === 0) {
      return { texto: `Nenhuma pendência.${naoLidas(contexto)}`, link: { href: "/extratos", rotulo: "Ver os extratos" } };
    }
    const maisCaro = [...contexto.grupos].sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade)[0];
    const peso =
      maisCaro.valor > 0 && contexto.valorAberto > 0
        ? `: ${plural(maisCaro.quantidade, "linha", "linhas")}, ${formatarMoedaCurta(maisCaro.valor)} dos ${formatarMoedaCurta(contexto.valorAberto)} em aberto`
        : `: ${plural(maisCaro.quantidade, "linha", "linhas")}`;
    return {
      texto: `${contexto.divergentes === 1 ? "Falta" : "Faltam"} ${plural(contexto.divergentes, "decisão sua", "decisões suas")}. Comece por “${maisCaro.rotulo}”${peso}.${naoLidas(contexto)}`,
      link: { href: maisCaro.href, rotulo: "Revisar" },
    };
  }

  if (assunto === "pendencias") {
    if (contexto.divergentes === 0) return { texto: "Nenhuma pendência." };
    const partes = contexto.grupos.map(
      (item) =>
        `${item.rotulo}: ${formatarInteiro(item.quantidade)}${item.valor > 0 ? ` (${formatarMoedaCurta(item.valor)})` : ""}`,
    );
    const inicio =
      contexto.valorAberto > 0
        ? `Os ${formatarMoedaCurta(contexto.valorAberto)} em aberto saem de ${plural(contexto.divergentes, "linha", "linhas")}`
        : `Sobraram ${plural(contexto.divergentes, "linha", "linhas")}, sem dinheiro em aberto`;
    return { texto: `${inicio}. ${lista(partes)}.`, link: { href: contexto.caminho, rotulo: "Abrir a lista" } };
  }

  if (assunto === "resumo") {
    const aberto =
      contexto.valorAberto > 0
        ? ` Ficaram ${formatarMoedaCurta(contexto.valorAberto)} em aberto, em ${plural(contexto.divergentes, "linha", "linhas")}.`
        : contexto.divergentes > 0
          ? ` Sobraram ${plural(contexto.divergentes, "linha", "linhas")}, sem dinheiro em aberto.`
          : " Nada ficou em aberto.";
    return {
      texto: `${Mes}: ${plural(contexto.processados, "lançamento", "lançamentos")}. ${formatarInteiro(contexto.batidos)} casaram sozinhos (${formatarPercentual(contexto.taxa)}).${aberto}${naoLidas(contexto)}`,
      link: { href: contexto.caminho, rotulo: "Abrir a conciliação" },
    };
  }

  return null;
}

/** Quando o assistente da Central está fora do ar: o que o roteiro sabe responder. */
export function foraDoRoteiro(contexto: Contexto): string {
  return `Por enquanto eu respondo sobre ${contexto.mes}: o resumo, o que sobrou, o que falta para fechar, tarifas e duplicidades. Para entender uma linha, peça para eu explicar a maior divergência. Para o passo a passo de cada tela, veja a Central de ajuda.`;
}

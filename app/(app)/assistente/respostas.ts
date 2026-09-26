import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { VisaoGeral } from "../conciliacoes/acoes";
import {
  estaResolvida,
  formatarInteiro,
  formatarMoedaCurta,
  formatarPercentual,
  resumir,
  statusDaLinha,
  valorEmAberto,
} from "../dashboard/resumo";
import { pendencias, type Pendencia } from "../visao-geral/pendencias";

/**
 * O que o assistente sabe: a conciliação mais recente, lida do backend. Ele não
 * inventa número nenhum — o design responde com um roteiro por palavra-chave
 * sobre dados de mentira; aqui o roteiro é o mesmo, com os números reais. A
 * única resposta que não sai daqui é a explicação de uma divergência, que vai à
 * IA do backend (`POST /explicacoes`) e só roda quando a pessoa pede.
 *
 * ponytail: sem backend de conversa, as perguntas que ele entende são as do
 * roteiro. Quando houver um endpoint de chat, `responder` vira a chamada a ele.
 */

export type Contexto = {
  /** "setembro", para o meio da frase; "Setembro", para abrir. */
  mes: string;
  Mes: string;
  processados: number;
  batidos: number;
  taxa: number;
  divergentes: number;
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

  const emAberto = conciliacao.linhas.filter((linha) => !estaResolvida(linha.status));
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

/** A primeira mensagem, como a do design: o mês em uma frase. */
export function saudacao(contexto: Contexto): string {
  if (contexto.divergentes === 0) {
    return `${contexto.Mes} está ${formatarPercentual(contexto.taxa)} conciliado. Nada sobrou para revisar.`;
  }
  const maisComum = [...contexto.grupos].sort((a, b) => b.quantidade - a.quantidade)[0];
  return `${contexto.Mes} está ${formatarPercentual(contexto.taxa)} conciliado. Sobraram ${plural(contexto.divergentes, "linha", "linhas")} para revisar, a maior parte em “${maisComum.rotulo}”.`;
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

export function responder(pergunta: string, contexto: Contexto): Resposta {
  const texto = normalizar(pergunta);
  const { Mes, mes } = contexto;

  if (/\b(explic|maior)/.test(texto)) {
    if (!contexto.maior) return { texto: `Nenhuma divergência em aberto em ${mes}: não há o que explicar.` };
    return { texto: "", explicar: true };
  }

  if (/\btarifa/.test(texto)) {
    const tarifas = grupo(contexto, "Tarifa bancária");
    if (!tarifas) return { texto: `Nenhuma tarifa bancária sobrou em ${mes}.` };
    return {
      texto: `${plural(tarifas.quantidade, "tarifa bancária", "tarifas bancárias")} em ${mes}, somando ${formatarMoedaCurta(tarifas.valor)}. Estão no extrato do banco e não no sistema de gestão — é a sobra que o Ledgr já sabe explicar, por isso tem categoria própria.`,
      link: { href: tarifas.href, rotulo: "Ver as tarifas" },
    };
  }

  if (/\bduplic/.test(texto)) {
    const duplicadas = grupo(contexto, "Possível duplicidade");
    if (!duplicadas) return { texto: `Nenhuma possível duplicidade em ${mes}.` };
    return {
      texto: `${plural(duplicadas.quantidade, "possível duplicidade", "possíveis duplicidades")} em ${mes}. É o lançamento que sobrou de um grupo que já formou par: pagamento repetido custa caro, vale conferir primeiro.`,
      link: { href: duplicadas.href, rotulo: "Ver as duplicidades" },
    };
  }

  if (/\b(falta|fech)/.test(texto)) {
    if (contexto.divergentes === 0 && contexto.naoLidas.length === 0) {
      return { texto: `Nada: ${mes} está pronto para fechar.`, link: { href: "/fechamentos", rotulo: "Ir aos fechamentos" } };
    }
    if (contexto.divergentes === 0) {
      return { texto: `Nenhuma divergência pede decisão.${naoLidas(contexto)}`, link: { href: "/extratos", rotulo: "Ver os extratos" } };
    }
    const maisCaro = [...contexto.grupos].sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade)[0];
    const peso =
      maisCaro.valor > 0 && contexto.valorAberto > 0
        ? `: ${plural(maisCaro.quantidade, "linha", "linhas")}, ${formatarMoedaCurta(maisCaro.valor)} dos ${formatarMoedaCurta(contexto.valorAberto)} em aberto`
        : `: ${plural(maisCaro.quantidade, "linha", "linhas")}`;
    return {
      texto: `Faltam ${plural(contexto.divergentes, "decisão sua", "decisões suas")}. Comece por “${maisCaro.rotulo}”${peso}.${naoLidas(contexto)}`,
      link: { href: maisCaro.href, rotulo: "Revisar" },
    };
  }

  // no começo da palavra: "previsão" não é pergunta sobre revisão
  if (/\b(sobr|abert|diverg|pendenc|revis)/.test(texto)) {
    if (contexto.divergentes === 0) return { texto: `Nada sobrou: todos os lançamentos de ${mes} casaram.` };
    const partes = contexto.grupos.map(
      (item) =>
        `${item.rotulo}: ${formatarInteiro(item.quantidade)}${item.valor > 0 ? ` (${formatarMoedaCurta(item.valor)})` : ""}`,
    );
    const inicio =
      contexto.valorAberto > 0
        ? `Os ${formatarMoedaCurta(contexto.valorAberto)} em aberto saem de ${plural(contexto.divergentes, "linha", "linhas")}`
        : `Sobraram ${plural(contexto.divergentes, "linha", "linhas")}, sem dinheiro em aberto`;
    return { texto: `${inicio} — ${lista(partes)}.`, link: { href: contexto.caminho, rotulo: "Abrir a lista" } };
  }

  if (/\b(resum|como esta|mes\b)/.test(texto) || texto.includes(mes)) {
    const aberto =
      contexto.valorAberto > 0
        ? ` Ficaram ${formatarMoedaCurta(contexto.valorAberto)} em aberto, em ${plural(contexto.divergentes, "linha", "linhas")}.`
        : contexto.divergentes > 0
          ? ` Sobraram ${plural(contexto.divergentes, "linha", "linhas")}, sem dinheiro em aberto.`
          : " Nada ficou em aberto.";
    return {
      texto: `${Mes}: ${plural(contexto.processados, "lançamento", "lançamentos")}. ${formatarInteiro(contexto.batidos)} casaram sozinhos — ${formatarPercentual(contexto.taxa)}.${aberto}${naoLidas(contexto)}`,
      link: { href: contexto.caminho, rotulo: "Abrir a conciliação" },
    };
  }

  return {
    texto: `Por enquanto eu respondo sobre ${mes}: o resumo, o que sobrou, o que falta para fechar, tarifas e duplicidades. Para entender uma linha, peça para eu explicar a maior divergência.`,
  };
}

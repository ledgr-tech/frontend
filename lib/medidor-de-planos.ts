import { planosDoTeste, type PlanoId } from "./assinatura";

/**
 * A escolha guiada do plano: a pessoa diz quantos lançamentos concilia por mês e a tela indica o
 * plano. A mesma conta vale no Cap. IV da landing e no /plano do primeiro acesso, e o plano escolhido
 * na landing chega ao /plano depois do cadastro.
 *
 * shortcut: o Escala (até 5.000) não está entre os planos do teste (ata de 14/10: Essencial, Padrão,
 * Avançado e o sob consulta); de 351 em diante, o plano é combinado com a equipe. Se ele voltar, a
 * faixa até 5.000 ganha preço aqui.
 */

/** Os passos do medidor, em lançamentos por mês; o último quer dizer "ou mais". */
export const PASSOS = [20, 50, 80, 100, 150, 180, 200, 250, 300, 350, 500, 1000, 2000, 3500, 5000, 6000];
export const ULTIMO_PASSO = PASSOS.length - 1;
/** Começa em 180: no Padrão, o plano em destaque. */
export const PASSO_INICIAL = PASSOS.indexOf(180);

/** As marcas da régua: o teto de cada plano e o fim. */
export const MARCAS: [passo: number, rotulo: string][] = [
  [PASSOS.indexOf(100), "100"],
  [PASSOS.indexOf(200), "200"],
  [PASSOS.indexOf(350), "350"],
  [PASSOS.indexOf(5000), "5.000+"],
];

export type Indicado = PlanoId | "volume";

const TETO: Record<Indicado, number> = { essencial: 100, padrao: 200, avancado: 350, volume: 6000 };

export function planoDoVolume(lancamentos: number): Indicado {
  if (lancamentos <= 100) return "essencial";
  if (lancamentos <= 200) return "padrao";
  if (lancamentos <= 350) return "avancado";
  return "volume";
}

/** O passo do medidor no teto do plano: o "ou escolha outro" leva até ele. */
export function passoDoPlano(plano: Indicado): number {
  return PASSOS.indexOf(TETO[plano]);
}

/** A marca que acende na régua para o plano indicado. */
export function marcaDoPlano(plano: Indicado): number {
  return plano === "volume" ? PASSOS.indexOf(5000) : passoDoPlano(plano);
}

/** O volume num ponto qualquer do medidor (que desliza entre os passos), arredondado de 10 em 10. */
export function volumeDoPasso(passo: number): number {
  const i = Math.min(Math.floor(passo), ULTIMO_PASSO - 1);
  const volume = PASSOS[i] + (PASSOS[i + 1] - PASSOS[i]) * (passo - i);
  return Math.round(volume / 10) * 10;
}

export function rotuloDoVolume(passo: number): string {
  return volumeDoPasso(passo).toLocaleString("pt-BR") + (passo === ULTIMO_PASSO ? "+" : "");
}

/** O que cada plano é e inclui. A IA fica no plano mais caro (mentoria de 19/10, #172). */
export const DETALHES: Record<Indicado, { para: string; itens: [texto: string, emBreve?: true][]; tag?: string }> = {
  essencial: {
    para: "Para a empresa que concilia o próprio banco.",
    itens: [["Conciliação banco × sistema"], ["Fechamento do mês com relatório em PDF"], ["Histórico das conciliações"]],
  },
  padrao: {
    para: "Para o escritório que concilia os clientes.",
    itens: [["Tudo do Essencial"], ["Pastas de extratos, uma por cliente"]],
    tag: "Para escritórios",
  },
  avancado: {
    para: "Para o escritório com equipe.",
    itens: [["Tudo do Padrão"], ["Convites para a equipe"], ["Assistente de IA no Ledgr", true], ["Conexão com o ChatGPT e o Claude", true]],
  },
  volume: {
    para: "Acima de 350 lançamentos, para a indústria e quem concilia muitos bancos, o plano e o preço são combinados com a gente.",
    itens: [["Tudo do Avançado"], ["Assistente de IA e conexão com o ChatGPT e o Claude", true]],
  },
};

export const CONTATO = "ledgrtech@gmail.com";

// o plano escolhido na landing, guardado no navegador até o /plano: o endereço não passa pelo cadastro
const CHAVE = "ledgr:plano-escolhido";

export function lembrarPlano(plano: PlanoId) {
  try {
    sessionStorage.setItem(CHAVE, plano);
  } catch {
    // sem armazenamento (aba privada), o /plano abre no Padrão
  }
}

/** O plano que a pessoa escolheu na landing, se for um dos planos do teste. */
export function planoLembrado(): PlanoId | null {
  try {
    const plano = sessionStorage.getItem(CHAVE);
    return planosDoTeste().some((p) => p.id === plano) ? (plano as PlanoId) : null;
  } catch {
    return null;
  }
}

import { analisarCsv, type Analise } from "@/lib/csv-extrato";
import { enviarExtrato, situacaoDoExtrato, type Falha, type SituacaoExtrato } from "./acoes";
import { lerBytes } from "./nova/ler-arquivo";

/**
 * O envio de um extrato, do arquivo escolhido até ele lido pelo backend. Mora fora
 * das telas porque duas o fazem: a de nova conciliação (os dois extratos) e a
 * janela de nova versão da comparação (só o do sistema). Não é Server Action: roda
 * no navegador e chama as actions.
 */

/**
 * Conferido antes de subir. Abaixo dos 5MB do backend de propósito: o arquivo
 * passa por uma Server Action, e a Vercel corta o corpo da requisição em 4,5MB
 * (o `bodySizeLimit` do next.config.ts acompanha esse teto).
 */
export const TAMANHO_MAXIMO_BYTES = 4 * 1024 * 1024;

// A Server Action lançou em vez de devolver um Resultado: corpo grande demais,
// rede caída ou deploy novo no meio ("Failed to find Server Action"). Recarregar
// resolve os dois últimos.
export const ERRO_SEM_RESPOSTA = "Não foi possível enviar agora. Recarregue a página e tente de novo.";

// O upload responde na hora com `status: "pendente"` e o parsing roda em
// background, então o resultado só aparece consultando de novo.
const INTERVALO_CONSULTA_MS = 1500;
const ESPERA_MAXIMA_MS = 90_000;

const TERMINAIS: readonly SituacaoExtrato["status"][] = [
  "concluido",
  "concluido_com_erros",
  "erro",
];

export type Etapa = "ocioso" | "conferindo" | "enviando" | "processando" | "conciliando";

export const RECADO: Record<Exclude<Etapa, "ocioso">, string> = {
  conferindo: "Conferindo os arquivos…",
  enviando: "Enviando os extratos…",
  processando: "Lendo os lançamentos…",
  conciliando: "Comparando banco e sistema…",
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Origem = "banco" | "sistema";

/** Um CSV que o backend não lê como está, esperando a pessoa apontar as colunas. */
export type Pendente = {
  origem: Origem;
  arquivo: File;
  analise: Extract<Analise, { motivo: "colunas" | "formato" }>;
};

// o que cada lado aceita: o banco exporta OFX ou CSV; o ERP, CSV. O PDF de lançamentos do ERP
// espera o spike do backend (#84), que decide até 13/10 se ele entra no MVP.
const FORMATOS: Record<Origem, string> = { banco: "OFX ou CSV", sistema: "CSV" };

/** O que o backend deixa saber de um extrato que ele recusou inteiro. */
export function motivoDaRecusa(situacao: SituacaoExtrato): string {
  const [primeira] = situacao.erros;
  if (primeira) {
    // nenhuma linha passou: a primeira recusada já diz o que há de errado com o arquivo
    return `Nenhuma linha do extrato do ${situacao.origem} pôde ser lida (linha ${primeira.identificador}: ${primeira.motivo}).`;
  }
  // erro do arquivo inteiro: o backend não grava o motivo, só o status
  return `O servidor não conseguiu ler o extrato do ${situacao.origem}. Confira se é o arquivo certo, exportado em ${FORMATOS[situacao.origem]}.`;
}

export function subir(arquivo: File, origem: Origem) {
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  // O campo que trava a integração (issue #20): obrigatório e sem default no
  // backend — ausente, o FastAPI devolve 422 antes de olhar o arquivo.
  dados.append("origem", origem);
  return enviarExtrato(dados);
}

/** Consulta até o parsing terminar. Devolve null se desistiu de esperar (ou a tela saiu). */
export async function aguardarProcessamento(
  extratoId: string,
  vivo: () => boolean,
): Promise<SituacaoExtrato | Falha | null> {
  const limite = Date.now() + ESPERA_MAXIMA_MS;
  while (Date.now() < limite) {
    const resposta = await situacaoDoExtrato(extratoId);
    if (!resposta.ok) return resposta;
    if (TERMINAIS.includes(resposta.dados.status)) return resposta.dados;
    if (!vivo()) return null;
    await esperar(INTERVALO_CONSULTA_MS);
  }
  return null;
}

/**
 * O CSV passa pelas regras do backend antes de subir: pronto para subir como está,
 * ilegível (o erro), ou esperando a pessoa apontar as colunas (a importação
 * interrompida). OFX o backend lê direto.
 */
export async function conferirCsv(
  arquivo: File,
  origem: Origem,
): Promise<{ pronto: true } | { pronto: false; erro: string } | { pronto: false; pendente: Pendente }> {
  if (!arquivo.name.toLowerCase().endsWith(".csv")) return { pronto: true };
  const analise = analisarCsv(await lerBytes(arquivo));
  if (analise.pronto) return { pronto: true };
  if (analise.motivo === "ilegivel") {
    return { pronto: false, erro: `Não foi possível ler "${arquivo.name}": ${analise.mensagem}` };
  }
  return { pronto: false, pendente: { origem, arquivo, analise } };
}

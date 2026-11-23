"use server";

import { ErroBackend, chamarBackend, ehContaInativa, emailDaSessao } from "@/lib/backend";
import { ehContaDeDemonstracao } from "@/lib/demo";
import type { Falha, Resultado } from "../conciliacoes/acoes";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { ehUuid } from "@/lib/rotas";

/**
 * O assistente responde dúvidas de uso e consultas sobre a empresa (backend #137/#223).
 * O backend consulta os números e protege a conversa antes de enviá-la ao provedor.
 * Ele não guarda conversa: o histórico vai daqui a cada pergunta.
 */

export type TurnoDaConversa = { papel: "usuario" | "assistente"; texto: string };

export type RespostaDoAssistente = {
  resposta: string;
  /** false quando o assistente não cobre a pergunta: a tela tenta o roteiro ou oferece a Central. */
  respondida: boolean;
  links: { titulo: string; caminho: string; tipo: "ajuda" | "tela" }[];
};

const TAMANHO_MAXIMO_PERGUNTA = 500;
const TAMANHO_MAXIMO_TURNO = 1000;
const MAXIMO_TURNOS = 6;
const TELA = /^[a-z0-9][a-z0-9-]{0,63}$/;
// O link vem do backend e vira um <a>: só seções da Central ou estas telas.
const CAMINHO_DA_AJUDA = /^\/ajuda\/[a-z0-9][a-z0-9-]*(#[a-z0-9][a-z0-9-]*)?$/;
const CAMINHOS_DE_TELA = new Set([
  "/fechamentos",
  "/historico",
  "/extratos",
  "/empresas",
  "/empresas?aba=equipe",
  "/conciliacoes/nova",
]);

function ehCaminhoDeTela(caminho: string): boolean {
  if (CAMINHOS_DE_TELA.has(caminho)) return true;
  const conciliacao = /^\/conciliacoes\/([^/?#]+)(?:\?sistema=([^&#]+))?$/.exec(caminho);
  return conciliacao !== null && ehUuid(conciliacao[1]) && (conciliacao[2] === undefined || ehUuid(conciliacao[2]));
}

function adaptarLink(link: unknown): RespostaDoAssistente["links"] {
  if (typeof link !== "object" || link === null) return [];
  const { titulo, caminho, tipo } = link as Record<string, unknown>;
  if (typeof titulo !== "string" || typeof caminho !== "string") return [];
  if ((tipo === undefined || tipo === "ajuda") && CAMINHO_DA_AJUDA.test(caminho)) {
    return [{ titulo, caminho, tipo: "ajuda" }];
  }
  if (tipo === "tela" && ehCaminhoDeTela(caminho)) return [{ titulo, caminho, tipo }];
  return [];
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: SEM_SERVIDOR };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  // 429: o limite do dia ("Tente amanhã") ou o por minuto, com o texto do backend
  if (status === 429) return { ok: false, status, erro: erro.detalhe || "Muitas perguntas seguidas. Espere um pouco." };
  if (ehContaInativa(erro)) return { ok: false, status, erro: erro.detalhe };
  // 503 (desligado, sem a Central ou o provedor falhou) e 404 (backend antes do #137): indisponível
  return { ok: false, status, erro: "O assistente está indisponível no momento." };
}

export async function perguntarAoAssistente(
  pergunta: string,
  tela: string | null,
  historico: TurnoDaConversa[],
  sobreNumeros = false,
): Promise<Resultado<RespostaDoAssistente>> {
  // Server Action é endpoint público: ao backend vai só o formato que ele aceita
  const limpa = typeof pergunta === "string" ? pergunta.trim() : "";
  if (!limpa || limpa.length > TAMANHO_MAXIMO_PERGUNTA) {
    return { ok: false, status: 422, erro: `A pergunta pode ter até ${TAMANHO_MAXIMO_PERGUNTA} caracteres.` };
  }
  // Só habilitar junto da flag de dados do backend: sem ela, valores da pergunta
  // não recebem a proteção de marcadores antes de seguir ao provedor.
  if (sobreNumeros && process.env.LEDGR_ASSISTENTE_DADOS !== "1") {
    return { ok: false, status: 404, erro: "A consulta dos números pelo assistente está indisponível no momento." };
  }
  // a demonstração é de qualquer visitante: cada pergunta dela gastaria o limite diário global do
  // backend, que é o dos clientes também. Lá, a conversa fica com o roteiro do mês e a Central
  if (ehContaDeDemonstracao(await emailDaSessao())) {
    return { ok: false, status: 503, erro: "O assistente está indisponível no momento." };
  }
  const turnos = (Array.isArray(historico) ? historico : [])
    .filter(
      (turno): turno is TurnoDaConversa =>
        (turno?.papel === "usuario" || turno?.papel === "assistente") && typeof turno.texto === "string" && turno.texto.trim() !== "",
    )
    .slice(-MAXIMO_TURNOS)
    .map((turno) => ({ papel: turno.papel, texto: turno.texto.slice(0, TAMANHO_MAXIMO_TURNO) }));
  try {
    const resposta = await chamarBackend<RespostaDoAssistente>("/assistente/perguntas", {
      method: "POST",
      corpo: {
        pergunta: limpa,
        ...(typeof tela === "string" && TELA.test(tela) && { tela }),
        historico: turnos,
      },
    });
    return {
      ok: true,
      dados: {
        resposta: resposta.resposta,
        respondida: resposta.respondida,
        links: Array.isArray(resposta.links) ? resposta.links.flatMap(adaptarLink) : [],
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

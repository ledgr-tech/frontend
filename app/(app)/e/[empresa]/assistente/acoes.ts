"use server";

import { ErroBackend, chamarBackend } from "@/lib/backend";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * O assistente da Central de ajuda (backend #137, front #172): responde "como faço tal coisa no Ledgr"
 * com o texto da Central (`/ajuda/conteudo.json`) e devolve os links das seções que citou. A pergunta não
 * leva dado da empresa. O backend não guarda conversa: o histórico vai daqui a cada pergunta.
 */

export type TurnoDaConversa = { papel: "usuario" | "assistente"; texto: string };

export type RespostaDoAssistente = {
  resposta: string;
  /** false quando a Central não cobre a pergunta: a tela oferece a Central inteira. */
  respondida: boolean;
  links: { titulo: string; caminho: string }[];
};

const TAMANHO_MAXIMO_PERGUNTA = 500;
const TAMANHO_MAXIMO_TURNO = 1000;
const MAXIMO_TURNOS = 6;
const TELA = /^[a-z0-9][a-z0-9-]{0,63}$/;
// só seções da Central: o link sai da resposta do modelo e vira um <a> na tela
const CAMINHO_DA_AJUDA = /^\/ajuda\/[a-z0-9][a-z0-9-]*(#[a-z0-9][a-z0-9-]*)?$/;

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  // 429: o limite do dia ("Tente amanhã") ou o por minuto, com o texto do backend
  if (status === 429) return { ok: false, status, erro: erro.detalhe || "Muitas perguntas seguidas. Espere um pouco." };
  // 503 (desligado, sem a Central ou o provedor falhou) e 404 (backend antes do #137): indisponível
  return { ok: false, status, erro: "O assistente está indisponível no momento." };
}

export async function perguntarAoAssistente(
  pergunta: string,
  tela: string | null,
  historico: TurnoDaConversa[],
): Promise<Resultado<RespostaDoAssistente>> {
  // Server Action é endpoint público: ao backend vai só o formato que ele aceita
  const limpa = typeof pergunta === "string" ? pergunta.trim() : "";
  if (!limpa || limpa.length > TAMANHO_MAXIMO_PERGUNTA) {
    return { ok: false, status: 422, erro: `A pergunta pode ter até ${TAMANHO_MAXIMO_PERGUNTA} caracteres.` };
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
        links: (resposta.links ?? []).filter((link) => typeof link?.titulo === "string" && CAMINHO_DA_AJUDA.test(link.caminho)),
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

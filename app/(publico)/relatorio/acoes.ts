"use server";

import { ErroBackend, chamarBackend } from "@/lib/backend";
import { adaptarRelatorioPublico, type RelatorioPublicoAPI } from "./publico";
import type { RelatorioDoFechamento } from "../../(app)/e/[empresa]/fechamentos/relatorio";

export type ResultadoRelatorioPublico =
  | { ok: true; relatorio: RelatorioDoFechamento; expiraEm: string }
  | { ok: false; motivo: "invalido" | "muitas_tentativas" | "falha" };

/**
 * Abre o relatório de um link público (backend #175), sem sessão. O token vem no corpo, nunca na URL: o
 * caminho iria para o log e para o `Referer`. Link inválido, vencido, revogado, de mês reaberto e a
 * flag desligada são o mesmo 404 no backend, e aqui a mesma mensagem.
 */
export async function consultarRelatorioPublico(token: string): Promise<ResultadoRelatorioPublico> {
  if (typeof token !== "string" || token.length < 1 || token.length > 200) return { ok: false, motivo: "invalido" };
  try {
    const dados = await chamarBackend<RelatorioPublicoAPI>("/relatorios-publicos/consultar", {
      method: "POST",
      corpo: { token },
      publica: true,
    });
    return { ok: true, relatorio: adaptarRelatorioPublico(dados), expiraEm: dados.link.expira_em };
  } catch (erro) {
    if (erro instanceof ErroBackend) {
      if (erro.status === 404 || erro.status === 422) return { ok: false, motivo: "invalido" };
      if (erro.status === 429) return { ok: false, motivo: "muitas_tentativas" };
    }
    return { ok: false, motivo: "falha" };
  }
}

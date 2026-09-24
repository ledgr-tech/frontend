import { caminhoDaConciliacao } from "@/lib/caminhos";
import type { Conciliacao, LinhaComparacao, Tom } from "@/lib/mock-data";
import { estaResolvida, statusDaLinha, valorEmAberto } from "../dashboard/resumo";

export type Pendencia = {
  /** O rótulo do status, o mesmo do selo na conciliação. */
  rotulo: string;
  tom: Tom;
  quantidade: number;
  /** Quanto o grupo deixa em aberto, em reais. */
  valor: number;
  /** O primeiro caso do grupo: "Revisar" abre direto nele. */
  href: string;
};

// Terracota custa dinheiro, ouro está incompleto, neutro já tem explicação — a
// mesma régua das cores de status (docs/superpowers/specs/2026-09-22-cores-de-status-design.md).
const PESO: Record<Tom, number> = { risco: 0, atencao: 1, neutro: 2, ok: 3 };

/**
 * As linhas em aberto de uma conciliação, agrupadas pelo que o backend achou.
 * O agrupamento é pelo rótulo do selo, então "sem correspondência" se divide no
 * lado que falta — são trabalhos diferentes (cobrar o banco ou lançar no ERP).
 */
export function pendencias(conciliacao: Conciliacao): Pendencia[] {
  const grupos = new Map<string, { tom: Tom; linhas: LinhaComparacao[] }>();
  for (const linha of conciliacao.linhas) {
    if (estaResolvida(linha.status)) continue;
    const { rotulo, tom } = statusDaLinha(linha);
    const grupo = grupos.get(rotulo) ?? { tom, linhas: [] };
    grupo.linhas.push(linha);
    grupos.set(rotulo, grupo);
  }

  return [...grupos]
    .map(([rotulo, { tom, linhas }]) => ({
      rotulo,
      tom,
      quantidade: linhas.length,
      valor: valorEmAberto(linhas),
      href: caminhoDaConciliacao(conciliacao.id, conciliacao.extratoSistemaId, linhas[0].id),
    }))
    .sort((a, b) => PESO[a.tom] - PESO[b.tom] || b.valor - a.valor);
}

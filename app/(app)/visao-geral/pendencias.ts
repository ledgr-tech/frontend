import { caminhoDaCategoria } from "@/lib/caminhos";
import type { Conciliacao, LinhaComparacao, Tom } from "@/lib/mock-data";
import { pedeDecisao, statusDaLinha, valorEmAberto } from "../dashboard/resumo";

export type Pendencia = {
  /** O rótulo do status, o mesmo do selo na conciliação. */
  rotulo: string;
  tom: Tom;
  quantidade: number;
  /** Quanto o grupo deixa em aberto, em reais. */
  valor: number;
  /**
   * A conciliação filtrada na categoria do grupo: "Revisar" abre a lista toda,
   * não só o primeiro caso. "Sem correspondência" no banco e no sistema caem na
   * mesma categoria do backend; a tabela mostra as duas, cada linha com o seu selo.
   */
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
    // a justificada já tem o motivo no registro: não pede mais atenção
    if (!pedeDecisao(linha)) continue;
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
      href: caminhoDaCategoria(conciliacao.id, conciliacao.extratoSistemaId, linhas[0].status),
    }))
    .sort((a, b) => PESO[a.tom] - PESO[b.tom] || b.valor - a.valor);
}

/**
 * As pendências do mês inteiro (revisão de 15/10): as categorias de todas as conciliações do mês,
 * somadas. Cada grupo abre a conciliação onde ele tem mais lançamentos; a régua de cor e a ordem
 * são as de `pendencias`.
 */
export function pendenciasDoMes(conciliacoes: Conciliacao[]): Pendencia[] {
  const grupos = new Map<string, Pendencia & { maior: number }>();
  for (const conciliacao of conciliacoes) {
    for (const grupo of pendencias(conciliacao)) {
      const atual = grupos.get(grupo.rotulo);
      if (!atual) {
        grupos.set(grupo.rotulo, { ...grupo, maior: grupo.quantidade });
        continue;
      }
      atual.quantidade += grupo.quantidade;
      atual.valor += grupo.valor;
      if (grupo.quantidade > atual.maior) Object.assign(atual, { maior: grupo.quantidade, href: grupo.href });
    }
  }
  return [...grupos.values()]
    .map(({ maior: _maior, ...grupo }) => grupo)
    .sort((a, b) => PESO[a.tom] - PESO[b.tom] || b.valor - a.valor);
}

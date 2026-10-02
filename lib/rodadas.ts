import type { LinhaComparacao } from "./mock-data";

/**
 * As rodadas de uma conciliação: o mesmo extrato do banco conciliado com versões
 * novas do extrato do sistema (spec 2026-10-02-conciliacao-em-rodadas).
 */

/** A linha em qualquer rodada; o mock não tem chave, e lá o id já é estável. */
export function chaveDaLinha(linha: LinhaComparacao): string {
  return linha.chave ?? linha.id;
}

import type { DiferencaDoSaldo, SaldoDoExtrato } from "@/lib/adaptadores";

// Os saldos de agosto da demonstração, os mesmos no hero e em "Na prática": o do extrato inteiro (as colunas
// mostram o do arquivo, não o do trecho). O do sistema começa igual e termina 80,95 acima: os 36,00 de juros e
// os 45,00 da tarifa que só o banco tem, menos os 0,05 que o banco creditou a mais no cartão. A diferença é
// banco menos sistema, como o backend manda (#474).
export const SALDO_DO_BANCO: SaldoDoExtrato = { inicial: 52380.47, final: 61904.12, data: "2026-08-31" };
export const SALDO_DO_SISTEMA: SaldoDoExtrato = { inicial: 52380.47, final: 61985.07, data: "2026-08-31" };
export const DIFERENCA_DOS_SALDOS: DiferencaDoSaldo = { valor: -80.95, motivo: null };

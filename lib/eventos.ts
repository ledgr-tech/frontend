/**
 * Eventos de janela entre partes do app que não se conhecem: a barra do topo e o tutorial, o
 * roteiro da Visão geral e a janela de Configurações.
 */
export const ABRIR_TUTORIAL = "ledgr:abrir-tutorial";
export const ABRIR_CONFIGURACOES = "ledgr:abrir-configuracoes";

export function abrirTutorial(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_TUTORIAL));
}

export function abrirConfiguracoes(secao: string): void {
  window.dispatchEvent(new CustomEvent(ABRIR_CONFIGURACOES, { detail: { secao } }));
}

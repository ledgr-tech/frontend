/**
 * Eventos de janela entre partes do app que não se conhecem: a barra do topo e o tutorial, o
 * roteiro da Visão geral e a janela de Configurações, e o menu de ajuda e o painel da ajuda.
 */
export const ABRIR_TUTORIAL = "ledgr:abrir-tutorial";
export const ABRIR_CONFIGURACOES = "ledgr:abrir-configuracoes";
export const ABRIR_AJUDA = "ledgr:abrir-ajuda";
/** A tolerância foi salva (em Configurações ou na Visão geral); `detail` é a nova, em dias. */
export const TOLERANCIA_SALVA = "ledgr:tolerancia-salva";

export function avisarToleranciaSalva(dias: number): void {
  window.dispatchEvent(new CustomEvent(TOLERANCIA_SALVA, { detail: dias }));
}

export function abrirAjuda(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_AJUDA));
}

export function abrirTutorial(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_TUTORIAL));
}

export function abrirConfiguracoes(secao: string): void {
  window.dispatchEvent(new CustomEvent(ABRIR_CONFIGURACOES, { detail: { secao } }));
}

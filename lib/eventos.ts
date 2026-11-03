/**
 * Eventos de janela entre partes do app que não se conhecem: a barra do topo e o tutorial, o
 * roteiro da Visão geral e a janela de Configurações, o menu de ajuda e o painel da ajuda, a
 * Central de ajuda e o assistente do menu lateral.
 */
export const ABRIR_TUTORIAL = "ledgr:abrir-tutorial";
export const ABRIR_CONFIGURACOES = "ledgr:abrir-configuracoes";
export const ABRIR_AJUDA = "ledgr:abrir-ajuda";
export const ABRIR_ASSISTENTE = "ledgr:abrir-assistente";
/** A tolerância foi salva (em Configurações ou na Visão geral); `detail` é a nova, em dias. */
export const TOLERANCIA_SALVA = "ledgr:tolerancia-salva";

export function avisarToleranciaSalva(dias: number): void {
  window.dispatchEvent(new CustomEvent(TOLERANCIA_SALVA, { detail: dias }));
}

export function abrirAjuda(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_AJUDA));
}

export function abrirAssistente(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_ASSISTENTE));
}

export function abrirTutorial(): void {
  window.dispatchEvent(new CustomEvent(ABRIR_TUTORIAL));
}

export function abrirConfiguracoes(secao: string): void {
  window.dispatchEvent(new CustomEvent(ABRIR_CONFIGURACOES, { detail: { secao } }));
}

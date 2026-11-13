/**
 * A Central de ajuda é um sistema à parte, em tela cheia: o "Voltar ao Ledgr" leva à tela de onde a
 * pessoa abriu a ajuda, que o menu Ajuda e o painel "Ajuda desta tela" guardam aqui ao abrir.
 */
const CHAVE = "ledgr:voltar-da-ajuda";
const INICIO = "/visao-geral";

export function lembrarDeOndeVeio() {
  try {
    sessionStorage.setItem(CHAVE, location.pathname + location.search);
  } catch {
    // sem armazenamento (aba privada), a volta é a Visão geral
  }
}

export function paraOndeVoltar(): string {
  try {
    const caminho = sessionStorage.getItem(CHAVE);
    // só um caminho deste site: "//outro.site", "/\outro.site" ou "/<tab>/outro.site" (o navegador lê os dois
    // como "//") ou uma URL inteira levariam para fora
    if (caminho?.startsWith("/") && !caminho.startsWith("//") && !/[\\\u0000-\u001f]/.test(caminho) && !caminho.startsWith("/ajuda")) {
      return caminho;
    }
  } catch {
    // idem
  }
  return INICIO;
}

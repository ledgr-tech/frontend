/**
 * A Content Security Policy aplicada (#158), com um nonce por requisição, como no guia de CSP do
 * Next (`proxy.ts` gera o nonce; o Next o põe sozinho nos scripts dele, e o layout no script do tema).
 *
 * - script-src: só o que leva o nonce, e o que esses scripts carregam ('strict-dynamic'). Um script
 *   injetado numa página não roda. O 'self' fica para navegador sem CSP3, que ignora o strict-dynamic.
 *   O 'unsafe-eval' é só do next dev: o React usa eval para montar a pilha de erros do servidor.
 * - style-src fica com 'unsafe-inline': o React escreve style="" no HTML, e nonce não vale para
 *   atributo. Com nonce na mesma diretiva o navegador ignoraria o 'unsafe-inline', então ela não leva.
 * - form-action: o login com Google sai de um formulário para accounts.google.com, e o Chrome confere
 *   o form-action também no redirecionamento.
 * - Sem vercel.live: o toolbar dos previews da Vercel fica bloqueado, de propósito.
 */
export function politicaDeConteudo(nonce: string, desenvolvimento: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Server Actions, a rota do CSV e o HMR do next dev: tudo na mesma origem
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** 128 bits do gerador do sistema, em base64: imprevisível e novo a cada página. */
export function novoNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

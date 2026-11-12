/**
 * Abaixo dos 5 MB do backend de propósito: o arquivo passa por uma Server Action, e a Vercel corta o
 * corpo da requisição em 4,5 MB (o `bodySizeLimit` do next.config.ts acompanha esse teto); a folga
 * fica para o envelope multipart.
 */
export const TAMANHO_MAXIMO_UPLOAD_BYTES = 4 * 1024 * 1024;

/** O arquivo da IA: a tela recusa já na escolha, e a Server Action se ele chegar mesmo assim. */
export const ARQUIVO_GRANDE_DEMAIS = "O arquivo passa de 4 MB. Envie um arquivo menor.";

/** Um extrato, na nova conciliação e na nova versão: um período menor cabe. */
export function extratoGrandeDemais(nome: string): string {
  return `O arquivo "${nome}" passa de 4 MB. Exporte um período menor.`;
}

// Validações e mensagens comuns aos formulários de acesso (login, recuperar senha, cadastro)

export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MENSAGEM_EMAIL_INCOMPLETO = "Confira o e-mail: parece incompleto.";

// validade do link de "Esqueci a senha": tem que bater com VALIDADE_TOKEN_MINUTOS em app/api/senha.py, no backend
export const VALIDADE_LINK_MINUTOS = 30;

// as mesmas regras do cadastro e do backend: 8 caracteres a 72 bytes (o bcrypt corta em 72)
export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA_BYTES = 72;

/** A senha nova e a repetição dela, na redefinição de senha e no aceite do convite. */
export function validarSenhaNova(senha: string, confirmacao: string): { senha?: string; confirmacao?: string } {
  if (senha.length < SENHA_MINIMA) return { senha: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  // acento conta 2 bytes
  if (new TextEncoder().encode(senha).length > SENHA_MAXIMA_BYTES) {
    return { senha: `Senha longa demais. Use no máximo ${SENHA_MAXIMA_BYTES} caracteres.` };
  }
  if (senha !== confirmacao) return { confirmacao: "A confirmação não bate com a senha nova." };
  return {};
}

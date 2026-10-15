// Validações e mensagens comuns aos formulários de acesso (login, recuperar senha, cadastro)

export const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MENSAGEM_EMAIL_INCOMPLETO = "Confira o e-mail: parece incompleto.";

// validade do link de "Esqueci a senha": tem que bater com VALIDADE_TOKEN_MINUTOS em app/api/senha.py, no backend
export const VALIDADE_LINK_MINUTOS = 30;

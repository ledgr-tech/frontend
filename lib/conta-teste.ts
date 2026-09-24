import "server-only";

/**
 * A conta de teste — a única que entra enquanto o backend não tem `/login`
 * (issue #57). Mora só no servidor: o `server-only` quebra o build se alguém
 * importar isto num componente client, que é como a senha ia parar no
 * JavaScript do navegador.
 *
 * O repositório é público, então a conta escrita aqui não protege nada — serve
 * só pra ninguém do time precisar configurar o ambiente local. Em produção vale
 * a conta das variáveis de ambiente; sem elas, ninguém entra.
 */

export type Conta = { email: string; senha: string };

export type ConferenciaConta = "ok" | "conta_nao_encontrada" | "senha_incorreta";

const CONTA_DESENVOLVIMENTO: Conta = { email: "financeiro@telhacerta.com.br", senha: "ledgr2026" };

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function contaDeTeste(): Conta | null {
  const email = normalizarEmail(process.env.LEDGR_CONTA_TESTE_EMAIL ?? "");
  const senha = process.env.LEDGR_CONTA_TESTE_SENHA ?? "";
  if (email && senha) return { email, senha };
  return process.env.NODE_ENV === "production" ? null : CONTA_DESENVOLVIMENTO;
}

/**
 * Diz **qual** credencial errou, porque o formulário mostra a mensagem no campo
 * certo. Quando o login real existir, essa distinção some (dizer qual e-mail
 * existe é justamente o vazamento que o backend evita).
 */
export function conferirConta(conta: Conta, email: string, senha: string): ConferenciaConta {
  if (normalizarEmail(email) !== conta.email) return "conta_nao_encontrada";
  if (senha !== conta.senha) return "senha_incorreta";
  return "ok";
}

/** O `authorize` do NextAuth: o usuário que vai pro token, ou null. */
export function autorizarContaDeTeste(
  email: string,
  senha: string,
): { id: string; email: string; empresaId: string } | null {
  const conta = contaDeTeste();
  if (!conta || conferirConta(conta, email, senha) !== "ok") return null;

  const empresaId = process.env.LEDGR_EMPRESA_ID_TESTE;
  if (!empresaId) {
    throw new Error(
      "LEDGR_EMPRESA_ID_TESTE não configurado: o backend rejeita token sem empresa_id.",
    );
  }
  return {
    id: process.env.LEDGR_USUARIO_ID_TESTE || empresaId,
    email: conta.email,
    empresaId,
  };
}

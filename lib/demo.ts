/**
 * Os atalhos de demonstração ("Entrar com Google" e o fim do cadastro), que
 * entram direto na conta de teste. Desligados por padrão: no site publicado,
 * qualquer visitante entraria na empresa de teste com os extratos dela.
 *
 * `NEXT_PUBLIC_` porque o login precisa saber se mostra o botão; o Next grava o
 * valor no build, então mudar a variável pede um deploy novo. Quem decide de
 * verdade é o servidor (`entrarNaDemonstracao`), que lê a mesma variável.
 */
export function demoAberta(): boolean {
  return process.env.NEXT_PUBLIC_LEDGR_DEMO_ABERTA === "1";
}

export const RECUSA_DEMONSTRACAO = "A conta de demonstração não pode ser alterada.";

/**
 * A conta do atalho é de todo visitante da demo: nela, a conta, a equipe e as regras da empresa não
 * mudam. Conciliar, justificar e fechar o mês seguem abertos, porque é isso que a demo mostra. Só no
 * servidor, com o e-mail de `emailDaSessao` (`lib/backend.ts`), o do token que o backend recebe.
 */
export function ehContaDeDemonstracao(email: string | null): boolean {
  const demonstracao = process.env.LEDGR_CONTA_TESTE_EMAIL?.trim().toLowerCase();
  return !!demonstracao && email?.toLowerCase() === demonstracao;
}

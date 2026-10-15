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

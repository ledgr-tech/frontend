/**
 * As opções do Sentry (#290), as mesmas no navegador e no servidor. Sem `NEXT_PUBLIC_SENTRY_DSN`
 * (local, testes, previews sem a variável) o init não manda nada.
 *
 * Só erros: sem traces nem replay, que gastam a cota e gravariam a tela com os lançamentos. E nada
 * do que a pessoa manda vai junto: o cookie de sessão É o token do backend, o corpo de uma Server
 * Action leva o extrato, e as variáveis da pilha podem guardar os dois. A política de privacidade
 * (`/privacidade`) promete só o endereço da tela, o navegador e a falha técnica.
 */
export function opcoesDoSentry(ambiente: string | undefined) {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: ambiente,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
  };
}

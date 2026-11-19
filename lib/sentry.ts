/**
 * As opções do Sentry (#290), as mesmas no navegador e no servidor. Sem `NEXT_PUBLIC_SENTRY_DSN`
 * (local, testes, previews sem a variável) o init não manda nada.
 *
 * Só erros: sem traces nem replay, que gastam a cota e gravariam a tela com os lançamentos. E nada
 * do que a pessoa manda vai junto: o cookie de sessão É o token do backend, o corpo de uma Server
 * Action leva o extrato, e as variáveis da pilha podem guardar os dois. O que vai é o que a política
 * de privacidade (`/privacidade`) diz: endereços das telas, o navegador, a falha técnica e os passos
 * antes dela (telas, cliques e chamadas), sem o console.
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
    beforeBreadcrumb: semTokenNaTrilha,
    beforeSend: semTokenNoEvento,
  };
}

/** O endereço sem o `#...`: redefinir-senha, aceitar-convite e confirmar-email levam o token ali. */
function semFragmento(url: unknown): unknown {
  return typeof url === "string" ? url.split("#")[0] : url;
}

/**
 * Cada passo antes do erro, sem o token do fragmento: o `replaceState` que apaga o token vira o
 * passo `from: /redefinir-senha#token=...`, e iria em qualquer erro seguinte. O console não vai:
 * os argumentos podem ter dados de um lançamento.
 */
export function semTokenNaTrilha<T extends { category?: string; data?: Record<string, unknown> }>(passo: T): T | null {
  if (passo.category === "console") return null;
  if (passo.data) {
    for (const chave of ["from", "to", "url"]) {
      if (chave in passo.data) passo.data[chave] = semFragmento(passo.data[chave]);
    }
  }
  return passo;
}

/** O endereço do erro sem o fragmento, para o erro que acontece antes de a página apagar o token. */
export function semTokenNoEvento<T extends { request?: { url?: string } }>(evento: T): T {
  if (evento.request?.url) evento.request.url = semFragmento(evento.request.url) as string;
  return evento;
}

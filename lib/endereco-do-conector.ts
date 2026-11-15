import { chamarBackend } from "./backend";
import { enderecoDoConector } from "./conexao-ia";

const ehEndereco = (valor: unknown): valor is string => typeof valor === "string" && /^https?:\/\/\S+$/.test(valor);
const semBarra = (endereco: string) => endereco.replace(/\/+$/, "");

/**
 * Os endereços públicos do backend, como ele mesmo os publica em `/.well-known/oauth-protected-resource`:
 * `conector` é o `resource` (o `MCP_URL_PUBLICA` dele, o único para o qual o token da IA vale) e `api` é a
 * base (`authorization_servers[0]`, o `OAUTH_ISSUER`). O `LEDGR_API_URL` do servidor do app pode ser outro
 * host do mesmo backend (o da Railway, por exemplo), e mostrá-lo na tela manda a pessoa ao endereço errado.
 * Sem resposta (conexão desligada, backend antigo, fora do ar), os de antes, montados pelo `LEDGR_API_URL`.
 */
export async function enderecosPublicos(): Promise<{ conector: string | null; api: string | null }> {
  let publicado: { resource?: unknown; authorization_servers?: unknown } = {};
  try {
    publicado =
      (await chamarBackend<typeof publicado>("/.well-known/oauth-protected-resource", {
        publica: true,
        signal: AbortSignal.timeout(5_000),
      })) ?? {};
  } catch {
    // caem nos endereços montados
  }
  const base = Array.isArray(publicado.authorization_servers) ? publicado.authorization_servers[0] : null;
  return {
    conector: ehEndereco(publicado.resource) ? semBarra(publicado.resource) : enderecoDoConector(),
    api: ehEndereco(base) ? semBarra(base) : process.env.LEDGR_API_URL?.replace(/\/+$/, "") || null,
  };
}

export const enderecoPublicoDoConector = async (): Promise<string | null> => (await enderecosPublicos()).conector;

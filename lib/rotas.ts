/**
 * A empresa ativa na URL (spec 2026-10-21-empresa-ativa-na-url): as telas do app vivem em
 * `/e/<uuid-da-empresa>/<tela>`. Estas são as regras do prefixo, puras e sem Next: quem monta, tira e
 * confere o `/e/<uuid>`. O cliente e o servidor as usam por `lib/link-do-app.tsx`, `lib/roteador.ts` e
 * `lib/rotas-servidor.ts`.
 */

/** As telas da empresa: a primeira parte do caminho depois do prefixo. O resto (login, ajuda, plano) fica fora dele. */
export const SECOES: readonly string[] = [
  "assinatura",
  "conciliacoes",
  "dashboard",
  "empresas",
  "extratos",
  "fechamentos",
  "historico",
  "regras",
  "visao-geral",
];

/**
 * A última empresa que a pessoa usou. Só escolhe o destino do redirect das URLs sem empresa; **nunca**
 * vai ao backend, que recebe a empresa da URL de cada aba.
 */
export const COOKIE_DA_EMPRESA_RECENTE = "ledgr-empresa-recente";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// o UUID só vale se o segmento acaba ali: no fim, ou antes de `/`, `?` ou `#`
const PREFIXO = /^\/e\/([0-9a-f-]{36})(?=\/|\?|#|$)/i;
/** Um segmento de um caminho antigo que pode ir ao destino: sem barra, `%`, `:` nem o `.` e `..` da travessia. */
const SEGMENTO_SEGURO = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}

/** A empresa de `/e/<uuid>` ou `/e/<uuid>/...`; null sem prefixo, ou com um segmento que não é UUID. */
export function empresaDoCaminho(caminho: string): string | null {
  const achado = PREFIXO.exec(caminho);
  return achado && ehUuid(achado[1]) ? achado[1] : null;
}

/** O caminho sem o prefixo: `/e/<uuid>/x?y=1` vira `/x?y=1`, `/e/<uuid>` vira `/`. Sem prefixo válido, volta igual. */
export function caminhoSemEmpresa(caminho: string): string {
  const achado = PREFIXO.exec(caminho);
  if (!achado || !ehUuid(achado[1])) return caminho;
  const resto = caminho.slice(achado[0].length);
  return resto === "" || resto[0] === "?" || resto[0] === "#" ? `/${resto}` : resto;
}

/** O primeiro segmento do caminho (sem prefixo, sem query nem hash), ou null. */
function primeiroSegmento(caminho: string): string | null {
  const [segmento] = caminhoSemEmpresa(caminho).split(/[?#]/)[0].split("/").filter(Boolean);
  return segmento ?? null;
}

/** A seção do caminho (`fechamentos`, `conciliacoes`...), ou null fora das telas da empresa. */
export function secaoDoCaminho(caminho: string): string | null {
  // um endereço absoluto (https://...) ou um caminho sem barra inicial não é tela do app
  if (!caminhoSemEmpresa(caminho).startsWith("/")) return null;
  const segmento = primeiroSegmento(caminho);
  return segmento !== null && SECOES.includes(segmento) ? segmento : null;
}

/** Se o caminho (com ou sem prefixo) é uma tela da empresa. */
export function ehDaEmpresa(caminho: string): boolean {
  return secaoDoCaminho(caminho) !== null;
}

/**
 * Põe o prefixo da empresa nas telas dela; o que não é tela do app (`/login`, `/ajuda/...`, endereço
 * absoluto) fica como está. Idempotente: um caminho que já tem prefixo valido volta igual, e é assim
 * que o seletor leva a outra empresa pelo mesmo `push`.
 */
export function comEmpresa(empresa: string, caminho: string): string {
  if (!ehUuid(empresa) || empresaDoCaminho(caminho) !== null || !ehDaEmpresa(caminho)) return caminho;
  return `/e/${empresa}${caminho}`;
}

/**
 * Para onde vai a pessoa ao trocar de empresa na tela em que está: a mesma tela, se ela não tem id; de
 * uma tela com id (comparação, detalhe, relatório) vai à raiz da seção, porque aquele id não existe no
 * outro cliente. A query se perde de propósito.
 */
export function destinoDaTroca(caminhoAtual: string, novaEmpresa: string): string {
  const segmentos = caminhoSemEmpresa(caminhoAtual).split(/[?#]/)[0].split("/").filter(Boolean);
  const secao = segmentos[0];
  if (!secao || !SECOES.includes(secao)) return `/e/${novaEmpresa}/visao-geral`;
  if (secao === "conciliacoes") {
    const ehNova = segmentos.length === 2 && segmentos[1] === "nova";
    return `/e/${novaEmpresa}${ehNova ? "/conciliacoes/nova" : "/dashboard"}`;
  }
  return `/e/${novaEmpresa}/${secao}`;
}

/** A empresa para abrir uma URL sem empresa: a recente, se ainda é da conta; senão a primeira; null sem nenhuma. */
export function escolherEmpresa(empresas: { id: string }[], recente: string | undefined): string | null {
  if (recente !== undefined && empresas.some((empresa) => empresa.id === recente)) return recente;
  return empresas[0]?.id ?? null;
}

/**
 * O destino de uma URL antiga, sem empresa (`/fechamentos?mes=...`), já com ela. Null se a seção não
 * existe ou se algum segmento do resto não é seguro (vazio, `.`, `..`, barra, `%`, `:`): o redirect não
 * pode sair do site nem subir de diretório por um endereço montado à mão.
 */
export function destinoDaUrlAntiga(
  secao: string,
  resto: string[] | undefined,
  busca: Record<string, string | string[] | undefined>,
  empresa: string,
): string | null {
  if (!ehUuid(empresa) || !SECOES.includes(secao)) return null;
  const segmentos = resto ?? [];
  if (!segmentos.every((segmento) => SEGMENTO_SEGURO.test(segmento) && segmento !== "..")) return null;
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) {
    if (valor === undefined) continue;
    for (const item of Array.isArray(valor) ? valor : [valor]) parametros.append(chave, item);
  }
  const query = parametros.toString();
  return `/e/${empresa}/${[secao, ...segmentos].join("/")}${query ? `?${query}` : ""}`;
}

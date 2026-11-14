/**
 * Para onde o navegador manda as violações da CSP (`report-uri` de lib/csp.ts, S1-19c): registra no log
 * da Vercel e responde 204. A rota é pública, então só aceita o formato do navegador, com tamanho
 * declarado, e registra três campos curtos: um laço de POSTs não enche o log de texto arbitrário.
 */
const TAMANHO_MAXIMO = 10_000;
const CAMPO_MAXIMO = 200;
const TIPOS = ["application/csp-report", "application/reports+json", "application/json"];

function campo(valor: unknown): string {
  return typeof valor === "string" ? valor.slice(0, CAMPO_MAXIMO) : "";
}

export async function POST(request: Request): Promise<Response> {
  const tipo = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!TIPOS.includes(tipo)) return new Response(null, { status: 415 });
  // sem content-length (corpo em pedaços) o text() leria tudo antes de conferir: recusa antes
  const tamanho = Number(request.headers.get("content-length"));
  if (!tamanho || tamanho > TAMANHO_MAXIMO) return new Response(null, { status: 413 });
  let relatorio: Record<string, unknown> | undefined;
  try {
    const corpo: unknown = JSON.parse(await request.text());
    const bruto = Array.isArray(corpo) ? corpo[0]?.body : (corpo as { "csp-report"?: unknown })?.["csp-report"];
    if (bruto && typeof bruto === "object") relatorio = bruto as Record<string, unknown>;
  } catch {
    // não é JSON: nada a registrar
  }
  if (!relatorio) return new Response(null, { status: 400 });
  console.warn(
    "[csp] violação",
    JSON.stringify({
      diretiva: campo(relatorio["violated-directive"] ?? relatorio.effectiveDirective),
      bloqueado: campo(relatorio["blocked-uri"] ?? relatorio.blockedURL),
      pagina: campo(relatorio["document-uri"] ?? relatorio.documentURL),
    }),
  );
  return new Response(null, { status: 204 });
}

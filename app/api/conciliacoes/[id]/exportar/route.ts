import { ehDivergencia, pareceUuid } from "@/lib/adaptadores";
import { baixarDoBackend, ErroBackend } from "@/lib/backend";

/**
 * O CSV do relatório de conciliação (`GET /conciliacoes/{id}/exportar`).
 *
 * O botão da tela não pode apontar para o backend: o JWT nunca chega ao
 * navegador. Esta rota, no servidor, chama com o Bearer da sessão e repassa o
 * arquivo. Não é proxy genérico — só este caminho, com os dois ids conferidos.
 *
 * O corpo passa como veio, sem virar texto: decodificar descartaria o BOM do
 * UTF-8, e sem ele o Excel em português abre os acentos quebrados.
 */

/**
 * Os cabeçalhos saem daqui, não do backend: o arquivo é da empresa (nenhum cache no caminho) e
 * sempre baixa como CSV. Do backend fica só o nome sugerido, se for um nome simples de CSV.
 */
function nomeDoArquivo(disposicao: string | null, id: string): string {
  return disposicao?.match(/filename="([\w.-]{1,100}\.csv)"/)?.[1] ?? `conciliacao-${id.slice(0, 8)}.csv`;
}

function erro(status: number, mensagem: string): Response {
  return Response.json({ erro: mensagem }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const busca = new URL(request.url).searchParams;
  const sistema = busca.get("sistema") || undefined;
  const status = busca.get("status") || undefined;
  // tudo vem da URL: nada entra no caminho do backend sem conferir
  if (!pareceUuid(id) || (sistema !== undefined && !pareceUuid(sistema))) {
    return erro(404, "Conciliação não encontrada.");
  }
  if (status !== undefined && !ehDivergencia(status)) {
    return erro(400, "Essa categoria de divergência não existe.");
  }

  try {
    const filtros = new URLSearchParams();
    if (sistema) filtros.set("extrato_sistema_id", sistema);
    if (status) filtros.set("status", status);
    const query = filtros.toString();
    const arquivo = await baixarDoBackend(`/conciliacoes/${id}/exportar${query ? `?${query}` : ""}`);

    return new Response(arquivo.body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeDoArquivo(arquivo.headers.get("Content-Disposition"), id)}"`,
      },
    });
  } catch (falha) {
    if (falha instanceof ErroBackend && falha.status === 401) {
      return erro(401, "Sua sessão expirou. Entre de novo para continuar.");
    }
    // o backend não distingue "não existe" de "é de outra empresa", nem a tela
    if (falha instanceof ErroBackend && falha.status === 404) {
      return erro(404, "Conciliação não encontrada.");
    }
    return erro(502, "Não foi possível gerar o CSV agora. Tente de novo em instantes.");
  }
}

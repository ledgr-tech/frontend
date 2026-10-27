import { pareceUuid } from "@/lib/adaptadores";
import { ehUuid } from "@/lib/rotas";
import { baixarDoBackend, ErroBackend } from "@/lib/backend";

/**
 * O arquivo original de um extrato (`GET /extratos/{id}/arquivo-original`, backend #139), guardado
 * no plano avançado. Como o CSV da conciliação: o JWT nunca chega ao navegador, então esta rota chama
 * com o Bearer da sessão e repassa os bytes sem virar texto. Só admin e gestor; o backend decide (403).
 *
 * O nome do arquivo quem dá é a tela, que já o tem da lista; daqui o corpo sai sempre como download
 * genérico, para o navegador nunca abrir o conteúdo de um extrato como página.
 */

function erro(status: number, mensagem: string): Response {
  return Response.json({ erro: mensagem }, { status });
}

const INDISPONIVEL = "Arquivo original indisponível no momento. Tente de novo em instantes.";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  // fora do proxy: a empresa ativa vem na query, e só um UUID segue (como cabeçalho, nunca no caminho)
  const empresa = new URL(request.url).searchParams.get("empresa") || undefined;
  if (empresa !== undefined && !ehUuid(empresa)) return erro(404, "Empresa não encontrada.");
  if (!pareceUuid(id)) return erro(404, "Extrato não encontrado.");

  try {
    const arquivo = await baixarDoBackend(`/extratos/${id}/arquivo-original`, { empresa });
    return new Response(arquivo.body, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "attachment",
      },
    });
  } catch (falha) {
    if (!(falha instanceof ErroBackend)) return erro(502, INDISPONIVEL);
    if (falha.status === 401) return erro(401, "Sua sessão expirou. Entre de novo para continuar.");
    if (falha.status === 403) return erro(403, "Só o admin ou o gestor da conta baixam o arquivo original.");
    if (falha.status === 404) return erro(404, "O arquivo original deste extrato não está disponível.");
    if (falha.status === 429) return erro(429, "Muitos downloads seguidos. Espere um minuto e tente de novo.");
    return erro(502, INDISPONIVEL);
  }
}

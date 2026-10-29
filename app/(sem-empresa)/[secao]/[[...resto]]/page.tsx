import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { contaDaSessao } from "@/app/(auth)/acoes";
import { COOKIE_DA_EMPRESA_RECENTE, SECOES, destinoDaUrlAntiga, ehUuid, escolherEmpresa } from "@/lib/rotas";

/**
 * As URLs de antes da empresa na URL (`/visao-geral`, `/conciliacoes/<id>?sistema=...`, favoritos e o
 * destino do login): levam à mesma tela na empresa certa, `/e/<empresa>/...`. A empresa é a última que a
 * pessoa usou (o cookie só escolhe o destino, nunca vai ao backend) ou, sem ela, a primeira da conta; sem a
 * lista de empresas (backend anterior ao #133), a da sessão. Uma seção que não existe, ou um endereço que
 * tenta sair do site, é 404: o destino só se monta de segmentos seguros (`destinoDaUrlAntiga`).
 */
export default async function UrlSemEmpresa({
  params,
  searchParams,
}: {
  params: Promise<{ secao: string; resto?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { secao, resto } = await params;
  // o que não é tela do app nem chega a pedir a sessão
  if (!SECOES.includes(secao)) notFound();

  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");

  const conta = await contaDaSessao();
  // sem a lista por falha do /me (não por backend antigo), a empresa da sessão pode não ser a da pessoa: a tela de erro deixa tentar de novo
  if (conta.indisponivel) throw new Error("Conta indisponível: tente de novo.");
  const recente = (await cookies()).get(COOKIE_DA_EMPRESA_RECENTE)?.value;
  const daSessao = ehUuid(sessao.user.contaId ?? "") ? sessao.user.contaId : null;
  const empresa = escolherEmpresa(conta.empresas, recente) ?? daSessao;
  if (!empresa) notFound();

  const destino = destinoDaUrlAntiga(secao, resto, await searchParams, empresa);
  if (!destino) notFound();
  redirect(destino);
}

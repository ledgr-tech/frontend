import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { podeFecharMes } from "@/lib/papel";
import { caminhoDoConsentimento, ehPedidoDeConexao } from "@/lib/rotas";
import { contaDaSessao } from "../acoes";
import { Consentimento } from "./consentimento";

export const metadata: Metadata = { title: "Autorizar conexão · Ledgr", robots: { index: false } };

/**
 * O consentimento da conexão do ChatGPT ou do Claude (backend #136, front #195). O backend manda o
 * navegador para cá com `?pedido=<id>` depois de conferir o pedido do OAuth. Precisa de sessão: sem ela,
 * vai ao login, que volta para cá com o mesmo pedido (`destinoDepoisDoLogin`).
 */
export default async function AutorizarConexaoPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string | string[] }>;
}) {
  const { pedido } = await searchParams;
  const id = ehPedidoDeConexao(pedido) ? pedido : null;
  const sessao = await auth();
  if (!sessao?.user?.email) redirect(id ? `/login?voltar=${encodeURIComponent(caminhoDoConsentimento(id))}` : "/login");
  const { papel } = await contaDaSessao();
  return <Consentimento pedido={id} email={sessao.user.email} podeAutorizar={podeFecharMes(papel)} />;
}

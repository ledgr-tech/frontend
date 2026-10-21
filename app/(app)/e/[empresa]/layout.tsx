import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { contaDaSessao } from "../../../(auth)/acoes";
import { Shell } from "./shell";

/**
 * Porta de entrada do app: sem sessão, ninguém passa daqui.
 *
 * A checagem é no servidor agora. Antes era um `useEffect` lendo o
 * `localStorage`, o que obrigava a renderizar nada até saber se havia sessão —
 * a tela piscava em branco a cada navegação, e o HTML da página protegida já
 * tinha sido enviado.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");

  const conta = await contaDaSessao();
  // sem plano, escolhe antes de entrar (spec 2026-10-15-primeiro-uso); sem a informação, segue
  if (conta.assinatura?.situacao === "sem_plano") redirect("/plano");
  return (
    <Shell
      email={sessao.user.email}
      empresa={conta.empresa}
      temSenha={conta.temSenha}
      papel={conta.papel}
      preferencias={conta.preferencias}
      assinatura={conta.assinatura}
    >
      {children}
    </Shell>
  );
}

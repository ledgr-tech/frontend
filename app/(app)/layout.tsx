import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  return <Shell email={sessao.user.email}>{children}</Shell>;
}

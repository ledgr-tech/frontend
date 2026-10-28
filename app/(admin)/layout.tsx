import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// a equipe do Ledgr, não buscador (o robots.ts também fecha /admin)
export const metadata: Metadata = { title: "Painel interno · Ledgr", robots: { index: false, follow: false } };

/**
 * A casca do painel interno (#222): fora do app dos clientes, sem o menu nem a empresa ativa. Pede sessão
 * como o app; quem é operador o backend decide a cada chamada, e as páginas respondem 404 aos demais.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");
  return (
    <div className="app-shell">
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 16px" }}>{children}</main>
    </div>
  );
}

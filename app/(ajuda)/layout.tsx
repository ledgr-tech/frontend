import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { LucideProvider } from "lucide-react";
import { auth } from "@/auth";
import { MotionRoot } from "../reveal";
import { TRACO_ICONE } from "../(app)/traco-icone";
import { BarraDaAjuda } from "./barra-da-ajuda";

/**
 * A Central de ajuda como um sistema à parte: tela cheia, sem o menu e a barra do app, e só o
 * "Voltar ao Ledgr" para sair. Precisa da sessão como o app; o `app-shell` traz os tokens e o tema
 * escuro dele.
 */
export default async function AjudaLayout({ children }: { children: ReactNode }) {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");
  return (
    <LucideProvider strokeWidth={TRACO_ICONE}>
      <div className="app-shell ajd-sistema">
        <BarraDaAjuda />
        <MotionRoot>
          <main>{children}</main>
        </MotionRoot>
      </div>
    </LucideProvider>
  );
}

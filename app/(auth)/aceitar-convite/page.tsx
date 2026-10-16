import type { Metadata } from "next";
import { auth } from "@/auth";
import { AceitarConvite } from "./formulario";

export const metadata: Metadata = { title: "Aceitar convite · Ledgr" };

/**
 * A página do link do convite (backend #69). Pública, como todo o grupo
 * `(auth)`: quem barra quem não entrou é o `(app)/layout.tsx`. Daqui sai só o
 * que o servidor sabe e o navegador não: se já há uma sessão aberta.
 */
export default async function AceitarConvitePage() {
  const sessao = await auth();
  return (
    <AceitarConvite
      conectadoComo={sessao?.user?.email ?? null}
      google={{ ligado: false, erro: null, convite: null }}
    />
  );
}

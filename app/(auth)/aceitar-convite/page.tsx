import type { Metadata } from "next";
import { auth } from "@/auth";
import { ehErroConviteGoogle, googleLigado } from "@/lib/google";
import { conviteDoCookie } from "../acoes";
import { AceitarConvite } from "./formulario";

export const metadata: Metadata = { title: "Aceitar convite · Ledgr" };

/**
 * A página do link do convite (backend #69). Pública, como todo o grupo
 * `(auth)`: quem barra quem não entrou é o `(app)/e/[empresa]/layout.tsx`. Daqui sai o que
 * o servidor sabe e o navegador não: se já há uma sessão aberta e, na volta do
 * Google com recusa (`?google=`), o convite guardado no cookie httpOnly.
 */
export default async function AceitarConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string | string[] }>;
}) {
  const motivo = (await searchParams).google;
  const erro = ehErroConviteGoogle(motivo) ? motivo : null;
  const sessao = await auth();
  return (
    <AceitarConvite
      conectadoComo={erro ? null : (sessao?.user?.email ?? null)}
      // o cookie só se lê na volta do Google (?google= com um motivo conhecido, ou "volta" depois de mostrá-lo):
      // em outra visita, o convite guardado pode ser de outra pessoa que usou este navegador
      google={{ ligado: googleLigado(), erro, convite: erro || motivo === "volta" ? await conviteDoCookie() : null }}
    />
  );
}

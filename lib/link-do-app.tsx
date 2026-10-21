"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useEmpresaAtiva } from "./empresa-ativa";
import { comEmpresa } from "./rotas";

/**
 * O `Link` do Next para dentro do app: o `href` das telas da empresa ganha o `/e/<empresa>` da aba, e o
 * resto (`/login`, `/ajuda/...`, um `href` que não é texto) passa como está. Sem empresa ativa, também.
 * Todo link das telas da empresa passa por aqui; o teste-guarda de `lib/rotas.guarda.test.ts` cobra.
 */
export default function LinkDoApp({ href, ...resto }: ComponentProps<typeof Link>) {
  const empresa = useEmpresaAtiva();
  const destino = typeof href === "string" && empresa ? comEmpresa(empresa.id, href) : href;
  return <Link href={destino} {...resto} />;
}

"use client";

import { usePathname } from "next/navigation";
import { caminhoSemEmpresa } from "@/lib/rotas";
import { Tutorial } from "./tutorial";
import { telaDoCaminho } from "./roteiros";

/** O tutorial da tela aberta. A `key` remonta o cartão ao trocar de tela, e o destaque da anterior sai. */
export function TutorialDaRota({ atraso, espera }: { atraso?: number; espera?: number }) {
  const tela = telaDoCaminho(caminhoSemEmpresa(usePathname()));
  return tela ? <Tutorial key={tela} tela={tela} atraso={atraso} espera={espera} /> : null;
}

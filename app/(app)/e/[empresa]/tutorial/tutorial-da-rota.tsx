"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { caminhoSemEmpresa } from "@/lib/rotas";
import { Tutorial } from "./tutorial";
import { telaDoCaminho } from "./roteiros";

/** O tutorial da tela aberta. A `key` remonta o cartão ao trocar de tela, e o destaque da anterior sai. */
export function TutorialDaRota({ atraso, espera }: { atraso?: number; espera?: number }) {
  const caminho = caminhoSemEmpresa(usePathname());
  // a Nova conciliação em modo reenvio (?sistemaAnterior=) é outra tarefa: quem chega ali já sabe conciliar
  const reenvio = useSearchParams()?.has("sistemaAnterior") && telaDoCaminho(caminho) === "nova-conciliacao";
  const tela = reenvio ? null : telaDoCaminho(caminho);
  return tela ? <Tutorial key={tela} tela={tela} atraso={atraso} espera={espera} /> : null;
}

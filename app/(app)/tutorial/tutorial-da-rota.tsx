"use client";

import { usePathname } from "next/navigation";
import { Tutorial } from "./tutorial";
import { telaDoCaminho } from "./roteiros";

/** O tutorial da tela aberta. A `key` remonta o cartão ao trocar de tela, e o destaque da anterior sai. */
export function TutorialDaRota({ atraso }: { atraso?: number }) {
  const tela = telaDoCaminho(usePathname());
  return tela ? <Tutorial key={tela} tela={tela} atraso={atraso} /> : null;
}

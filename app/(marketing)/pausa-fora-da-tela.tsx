"use client";

import { useEffect } from "react";

/**
 * Pausa as animações CSS das seções da landing que estão fora da janela (MV-03): a página parada no
 * topo seguia animando a dica do mouse e o mascote dos depoimentos (laços infinitos) e as entradas das
 * cenas lá embaixo. Com a seção à vista (ou a 200px dela), tudo volta de onde parou.
 */
export function PausaForaDaTela() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const secoes = document.querySelectorAll<HTMLElement>(".landing section");
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const { target, isIntersecting } of entradas) {
          if (isIntersecting) target.removeAttribute("data-fora-da-tela");
          else target.setAttribute("data-fora-da-tela", "");
        }
      },
      { rootMargin: "200px 0px" },
    );
    secoes.forEach((secao) => observador.observe(secao));
    return () => observador.disconnect();
  }, []);
  return null;
}

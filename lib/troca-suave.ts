"use client";

import { useEffect, useRef, type RefObject } from "react";

/** A curva de saída da casa (`--ease-out` em globals.css), para as animações feitas em JS. */
export const CURVA_DE_SAIDA = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Quando `chave` muda (outra folha, pessoa ou empresa escolhida na lista), o painel ao lado chega em
 * 160ms, com fade e 4px de subida, em vez de trocar seco. Anima o próprio elemento, sem remontar: o
 * painel é `aria-live` e um remontado não seria anunciado. Na primeira pintura não anima (a troca de
 * tela já cuida da entrada) e, para quem pediu menos movimento, fica só o fade.
 */
export function useTrocaSuave(ref: RefObject<HTMLElement | null>, chave: unknown) {
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const elemento = ref.current;
    if (!elemento || typeof elemento.animate !== "function") return;
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    elemento.animate(
      reduzido
        ? [{ opacity: 0.4 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
      { duration: 160, easing: CURVA_DE_SAIDA },
    );
  }, [ref, chave]);
}

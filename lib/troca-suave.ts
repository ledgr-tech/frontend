"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** A curva de saída da casa (`--ease-out` em globals.css), para as animações feitas em JS. */
export const CURVA_DE_SAIDA = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Quando `chave` muda (outra folha, pessoa ou empresa escolhida na lista), o painel ao lado chega em
 * 160ms, com fade e 4px de subida, em vez de trocar seco. Anima o próprio elemento, sem remontar: o
 * painel é `aria-live` e um remontado não seria anunciado. Na primeira pintura não anima (a troca de
 * tela já cuida da entrada) e, para quem pediu menos movimento, fica só o fade.
 */
export function useTrocaSuave(ref: RefObject<HTMLElement | null>, chave: unknown) {
  const anterior = useRef(chave);

  useEffect(() => {
    if (Object.is(anterior.current, chave)) return;
    anterior.current = chave;
    const elemento = ref.current;
    if (!elemento || typeof elemento.animate !== "function") return;
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const animacao = elemento.animate(
      reduzido
        ? [{ opacity: 0.4 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(4px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
      { duration: 160, easing: CURVA_DE_SAIDA },
    );
    return () => animacao.cancel();
  }, [ref, chave]);
}

function menosMovimento() {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
}

/**
 * A saída de uma janela ou painel: resolve quando a animação acaba (`fill: forwards`, para o elemento
 * não piscar de volta antes de sair da tela). Sem Web Animations (jsdom) ou sem elemento, resolve na hora.
 * Para quem pediu menos movimento, só o fade. `pseudo` anima um pseudo-elemento, como o `::backdrop`.
 */
export function sairComSuavidade(
  elemento: HTMLElement | null | undefined,
  quadros: Keyframe[],
  duracao: number,
  pseudo?: string,
): Promise<void> {
  if (!elemento || typeof elemento.animate !== "function") return Promise.resolve();
  const animacao = elemento.animate(menosMovimento() ? [{ opacity: 1 }, { opacity: 0 }] : quadros, {
    duration: duracao,
    easing: CURVA_DE_SAIDA,
    fill: "forwards",
    ...(pseudo ? { pseudoElement: pseudo } : {}),
  });
  return animacao.finished.then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Para o que monta com `{aberto && ...}`: mantém o elemento montado por `ms` depois de fechar, com
 * `saindo` ligado, para o CSS (`[data-saindo]`) tocar a saída. Reabrir cancela a espera.
 */
export function usePresenca(aberto: boolean, ms = 100) {
  const [montado, setMontado] = useState(aberto);
  if (aberto && !montado) setMontado(true);

  useEffect(() => {
    if (aberto || !montado) return;
    const timer = setTimeout(() => setMontado(false), ms);
    return () => clearTimeout(timer);
  }, [aberto, montado, ms]);

  return { montado: aberto || montado, saindo: !aberto && montado };
}

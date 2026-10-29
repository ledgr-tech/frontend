"use client";

import { useEffect, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { ULTIMO_PASSO } from "@/lib/medidor-de-planos";

/**
 * O que o medidor de planos da landing (regua-que-mede.tsx) e o do /plano dividem para trocar suave:
 * as setas do teclado de passo em passo (o medidor desliza em frações) e a caixa do plano que acompanha
 * a altura do conteúdo.
 */

/** O medidor desliza entre os passos; pelo teclado, as setas vão de um passo ao seguinte. */
export function teclarNoMedidor(setPasso: Dispatch<SetStateAction<number>>) {
  return (evento: KeyboardEvent<HTMLInputElement>) => {
    const sobe = evento.key === "ArrowRight" || evento.key === "ArrowUp";
    if (!sobe && evento.key !== "ArrowLeft" && evento.key !== "ArrowDown") return;
    evento.preventDefault();
    setPasso((p) => Math.max(0, Math.min(ULTIMO_PASSO, sobe ? Math.floor(p) + 1 : Math.ceil(p) - 1)));
  };
}

/** O número do medidor enquanto conta até o volume; o último passo quer dizer "ou mais". */
export function formatarVolume(passo: number) {
  return (volume: number) => Math.round(volume).toLocaleString("pt-BR") + (passo === ULTIMO_PASSO ? "+" : "");
}

/**
 * A caixa do plano muda de altura quando o plano muda (o Volume não tem preço, cada plano tem seus
 * itens): ela acompanha a altura do conteúdo com uma transição de CSS, em vez de pular.
 */
export function useAlturaQueDesliza(plano: string) {
  const caixa = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  // a key troca o conteúdo a cada plano, então o efeito volta a observar o nó novo
  useEffect(() => {
    const no = conteudo.current;
    if (!no || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => {
      if (caixa.current) caixa.current.style.height = `${no.offsetHeight}px`;
    });
    observador.observe(no);
    return () => observador.disconnect();
  }, [plano]);
  return { caixa, conteudo };
}

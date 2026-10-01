"use client";

import { m, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

/**
 * O fio em onda da trilha de "Por dentro", que se desenha para baixo conforme a página rola:
 * a ponta fica na altura `ponta` da tela (em % a partir do topo), e o que já passou dela aparece.
 * Rolar para cima recolhe o fio. O recorte é um clip-path num motion value, sem re-render.
 * Com movimento reduzido, quem mostra o fio inteiro é o globals.css: decidido aqui, o servidor e o
 * navegador renderizariam fios diferentes.
 */
export function FioDaTrilha({ ponta }: { ponta: number }) {
  const fio = useRef<HTMLSpanElement>(null);
  // 0 quando o topo do fio chega à ponta, 1 quando o fim dele chega
  const { scrollYProgress } = useScroll({ target: fio, offset: [`start ${ponta}%`, `end ${ponta}%`] });
  const recorte = useTransform(scrollYProgress, (desenhado) => `inset(0 0 ${(1 - desenhado) * 100}% 0)`);

  return <m.span ref={fio} aria-hidden="true" className="por-dentro-fio" style={{ clipPath: recorte }} />;
}

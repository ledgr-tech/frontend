"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function semMovimento(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Se há conteúdo acima ou abaixo do que se vê numa caixa que rola sem barra: a borda daquele lado esfuma e,
 * embaixo, aparece o "Mais abaixo". Mede ao rolar e quando a caixa ou o conteúdo mudam de tamanho (os fatos
 * chegam depois). Usado no detalhe do painel da comparação e no painel lateral da linha.
 */
export function useAvisoDeRolagem() {
  const caixa = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const [borda, setBorda] = useState({ acima: false, abaixo: false });
  const medir = useCallback(() => {
    const el = caixa.current;
    if (!el) return;
    // 2px de folga: zoom e frações de pixel deixam o fim um tico antes do scrollHeight
    const acima = el.scrollTop > 2;
    const abaixo = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setBorda((atual) => (atual.acima === acima && atual.abaixo === abaixo ? atual : { acima, abaixo }));
  }, []);
  useEffect(() => {
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    if (caixa.current) observador.observe(caixa.current);
    if (conteudo.current) observador.observe(conteudo.current);
    return () => observador.disconnect();
  }, [medir]);
  const descer = useCallback(() => {
    const el = caixa.current;
    el?.scrollBy?.({ top: el.clientHeight * 0.7, behavior: semMovimento() ? "auto" : "smooth" });
  }, []);
  return { caixa, conteudo, medir, descer, ...borda };
}

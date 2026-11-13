"use client";

import { useEffect, useState } from "react";

/** ~18ms por letra, entre 0,6s e 2,2s no total: texto longo não vira espera. */
export function duracaoDaDigitacao(texto: string): number {
  return Math.min(2200, Math.max(600, texto.length * 18));
}

/**
 * A explicação que acabou de chegar aparece sendo digitada. O texto inteiro já ocupa o lugar desde o
 * começo (o que falta digitar fica transparente), então nada abaixo dele pula; o leitor de tela lê
 * tudo de uma vez. Quem pediu menos movimento vê o texto pronto.
 */
function semDigitar(): boolean {
  return typeof requestAnimationFrame === "undefined" || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** Cada texto novo pede um componente novo (`key`): a digitação começa uma vez por montagem. */
export function TextoDigitado({ texto, aoTerminar }: { texto: string; aoTerminar?: () => void }) {
  const [letras, setLetras] = useState(() => (semDigitar() ? texto.length : 0));

  useEffect(() => {
    if (semDigitar()) {
      aoTerminar?.();
      return;
    }
    const duracao = duracaoDaDigitacao(texto);
    let quadro = 0;
    let inicio: number | null = null;
    function passo(agora: number) {
      inicio ??= agora;
      const feito = Math.min(1, (agora - inicio) / duracao);
      setLetras(Math.round(feito * texto.length));
      if (feito < 1) quadro = requestAnimationFrame(passo);
      else aoTerminar?.();
    }
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
    // aoTerminar fica de fora: trocar a função não recomeça a digitação
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <>
      {texto.slice(0, letras)}
      {letras < texto.length && (
        <>
          <span className="digitando-cursor" aria-hidden="true" />
          <span className="digitando-resto">{texto.slice(letras)}</span>
        </>
      )}
    </>
  );
}

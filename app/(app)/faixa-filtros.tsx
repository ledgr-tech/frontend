"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A faixa dos filtros da galeria de extratos e da mesa de fechamento, que gruda sob a barra do
 * topo enquanto as folhas rolam. O painel ao lado gruda logo abaixo dela, então precisa da altura
 * da faixa — e ela muda: em tela estreita os filtros quebram em duas linhas. A faixa se mede e
 * passa a altura ao bloco de cima (`--extratos-filtros-altura`); sem medição, vale a de uma linha.
 */
export function FaixaFiltros({ children }: { children: ReactNode }) {
  const faixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = faixa.current;
    const corpo = elemento?.parentElement;
    if (!elemento || !corpo || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => {
      corpo.style.setProperty("--extratos-filtros-altura", `${elemento.offsetHeight}px`);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={faixa} className="extratos-filtros">
      {children}
    </div>
  );
}

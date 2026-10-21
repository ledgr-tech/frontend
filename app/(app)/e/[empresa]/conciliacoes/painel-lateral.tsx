"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRoteador } from "@/lib/roteador";

/**
 * O painel à direita, sobre a tela de onde ele abriu (revisão de estilo de 15/10): a pessoa nunca
 * sai da comparação. Aberto por navegação (rota interceptada, `@painel`), então fechar é voltar no
 * histórico: Esc, o fundo e o X do conteúdo fazem o mesmo `router.back()`, e o botão voltar do
 * navegador também fecha. O fundo escurece pouco, para a comparação continuar legível atrás.
 */
export function PainelLateral({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const router = useRoteador();
  const painel = useRef<HTMLElement>(null);

  useEffect(() => {
    // o foco entra no painel, para o teclado e o leitor de tela começarem por ele
    painel.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") router.back();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [router]);

  return (
    <>
      <div className="painel-fundo" data-testid="painel-fundo" aria-hidden="true" onClick={() => router.back()} />
      <aside ref={painel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={rotulo} className="painel-lateral">
        {children}
      </aside>
    </>
  );
}

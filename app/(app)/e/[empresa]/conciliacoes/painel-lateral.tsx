"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRoteador } from "@/lib/roteador";
import { sairComSuavidade } from "@/lib/troca-suave";

/**
 * O painel à direita, sobre a tela de onde ele abriu (revisão de estilo de 15/10): a pessoa nunca
 * sai da comparação. Aberto por navegação (rota interceptada, `@painel`), então fechar é voltar no
 * histórico: Esc, o fundo e o X do conteúdo fazem o mesmo `router.back()`, e o botão voltar do
 * navegador também fecha. O fundo escurece pouco, para a comparação continuar legível atrás.
 */
export function PainelLateral({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const router = useRoteador();
  const painel = useRef<HTMLElement>(null);
  const fundo = useRef<HTMLDivElement>(null);
  const saindo = useRef(false);

  // Esc e o fundo tocam a saída (160ms: o painel desliza 24px e some, o fundo clareia) antes do `back()`;
  // o botão voltar do navegador continua instantâneo
  function fechar() {
    if (saindo.current) return;
    saindo.current = true;
    void Promise.all([
      sairComSuavidade(
        painel.current,
        [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: "translateX(24px)" },
        ],
        160,
      ),
      sairComSuavidade(fundo.current, [{ opacity: 1 }, { opacity: 0 }], 160),
    ]).then(() => router.back());
  }
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });

  useEffect(() => {
    // o foco entra no painel, para o teclado e o leitor de tela começarem por ele
    painel.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") fecharRef.current();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <>
      <div ref={fundo} className="painel-fundo" data-testid="painel-fundo" aria-hidden="true" onClick={fechar} />
      <aside ref={painel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={rotulo} className="painel-lateral">
        {children}
      </aside>
    </>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useRoteador } from "@/lib/roteador";
import { sairComSuavidade } from "@/lib/troca-suave";
import { useAvisoDeRolagem } from "./aviso-de-rolagem";

/**
 * O painel à direita, sobre a tela de onde ele abriu (revisão de estilo de 15/10): a pessoa nunca
 * sai da comparação. Aberto por navegação (rota interceptada, `@painel`), então fechar é voltar no
 * histórico: Esc, o fundo e o X do conteúdo fazem o mesmo `router.back()`, e o botão voltar do
 * navegador também fecha. O fundo escurece pouco, para a comparação continuar legível atrás.
 * Rola sem barra, como o detalhe do painel da comparação: a borda esfuma e o "Mais abaixo" diz que há mais.
 */
export function PainelLateral({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const router = useRoteador();
  const painel = useRef<HTMLElement>(null);
  const fundo = useRef<HTMLDivElement>(null);
  const saindo = useRef(false);
  const { caixa, conteudo, medir, descer, acima, abaixo } = useAvisoDeRolagem();

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
    // o foco entra na caixa que rola, para as setas e o Page Down rolarem o painel desde o início
    caixa.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") fecharRef.current();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [caixa]);

  return (
    <>
      <div ref={fundo} className="painel-fundo" data-testid="painel-fundo" aria-hidden="true" onClick={fechar} />
      <aside ref={painel} role="dialog" aria-modal="true" aria-label={rotulo} className="painel-lateral">
        <div
          ref={caixa}
          tabIndex={-1}
          className="painel-rolagem"
          onScroll={medir}
          data-acima={acima || undefined}
          data-abaixo={abaixo || undefined}
        >
          <div ref={conteudo}>{children}</div>
        </div>
        {/* atalho do ponteiro: o teclado e o leitor de tela já rolam a caixa */}
        <button
          type="button"
          className="comp-mais"
          aria-hidden="true"
          tabIndex={-1}
          data-visivel={abaixo || undefined}
          onClick={descer}
        >
          Mais abaixo <ChevronDown size={14} aria-hidden="true" />
        </button>
      </aside>
    </>
  );
}

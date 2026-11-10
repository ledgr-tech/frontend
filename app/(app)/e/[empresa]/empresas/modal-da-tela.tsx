"use client";

import { createContext, useContext, useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { sairComSuavidade } from "@/lib/troca-suave";

const FecharJanela = createContext<(() => void) | null>(null);

/**
 * O botão de fechar de dentro da janela (Cancelar, Fechar, Voltar): fecha com a saída suave da
 * `ModalDaTela` que o envolve. Fora de uma (um teste do conteúdo, por exemplo), fecha na hora com
 * `aoFechar`.
 */
export function BotaoFecharJanela({ aoFechar, ...resto }: Omit<ComponentProps<"button">, "onClick" | "type"> & { aoFechar: () => void }) {
  return <button type="button" {...resto} onClick={useContext(FecharJanela) ?? aoFechar} />;
}

/**
 * A janela modal da tela Empresas (cadastrar empresa, convidar pessoa), no meio da tela, com o fundo
 * escurecido e desfocado e a entrada suave: o mesmo <dialog> nativo com `showModal` da comparação
 * (`.espia` por fora, a `.dialog` de sempre por dentro), que prende o foco e fecha no Esc. Fecha também
 * com um clique no fundo. Monta só quando aberta; o que quem a abre guarda (a lista, a aba) não se perde.
 * `classe` vai no <dialog>, e `fundo` fica nele, antes da caixa: o que desenha por cima do fundo escurecido
 * e por baixo da janela (o confete da comemoração da assinatura).
 */
export function ModalDaTela({
  titulo,
  aoFechar,
  classe,
  fundo,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  classe?: string;
  fundo?: ReactNode;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const quemAbriu = useRef<Element | null>(null);
  const saindo = useRef(false);

  // a saída (140ms, mais curta e discreta que a entrada) toca antes de a janela desmontar; uma vez só
  function fechar() {
    if (saindo.current) return;
    saindo.current = true;
    const elemento = dialogo.current;
    void Promise.all([
      sairComSuavidade(
        elemento,
        [
          { opacity: 1, transform: "translateY(0) scale(1)" },
          { opacity: 0, transform: "translateY(8px) scale(0.98)" },
        ],
        140,
      ),
      sairComSuavidade(elemento, [{ opacity: 1 }, { opacity: 0 }], 140, "::backdrop"),
    ]).then(aoFechar);
  }

  useEffect(() => {
    const elemento = dialogo.current;
    // a janela desmonta sem `close()`, e aí o navegador não devolve o foco: volta aqui a quem a abriu
    // guardado uma vez só: no StrictMode o efeito roda de novo com o foco já dentro da janela
    quemAbriu.current ??= document.activeElement;
    if (elemento && !elemento.open) {
      if (typeof elemento.showModal === "function") elemento.showModal();
      // sem showModal (navegador antigo, jsdom): abre do mesmo jeito
      else elemento.setAttribute("open", "");
      // o showModal já leva o foco para dentro; sem ele, o Esc nunca chegaria à janela
      if (!elemento.contains(document.activeElement)) elemento.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    }
    return () => {
      const alvo = quemAbriu.current;
      if (alvo instanceof HTMLElement && alvo.isConnected) alvo.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      className={classe ? `espia modal-suave ${classe}` : "espia modal-suave"}
      aria-labelledby={tituloId}
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        evento.preventDefault();
        fechar();
      }}
      onClose={aoFechar}
      // o fundo escurecido é o próprio <dialog> (a caixa de dentro cobre a largura toda): clicar nele é clicar fora
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) fechar();
      }}
    >
      {fundo}
      <FecharJanela.Provider value={fechar}>
        <div className="dialog">
          <span id={tituloId} className="dialog-title">
            {titulo}
          </span>
          {children}
        </div>
      </FecharJanela.Provider>
    </dialog>
  );
}

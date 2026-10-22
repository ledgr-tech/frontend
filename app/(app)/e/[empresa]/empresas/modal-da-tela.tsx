"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A janela modal da tela Empresas (cadastrar empresa, convidar pessoa), no meio da tela, com o fundo
 * escurecido e desfocado e a entrada suave: o mesmo <dialog> nativo com `showModal` da comparação
 * (`.espia` por fora, a `.dialog` de sempre por dentro), que prende o foco e fecha no Esc. Fecha também
 * com um clique no fundo. Monta só quando aberta; o que quem a abre guarda (a lista, a aba) não se perde.
 */
export function ModalDaTela({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento || elemento.open) return;
    if (typeof elemento.showModal === "function") elemento.showModal();
    // sem showModal (navegador antigo, jsdom): abre do mesmo jeito
    else elemento.setAttribute("open", "");
    // o showModal já leva o foco para dentro; sem ele, o Esc nunca chegaria à janela
    if (!elemento.contains(document.activeElement)) elemento.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="espia modal-suave"
      aria-labelledby={tituloId}
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        evento.preventDefault();
        aoFechar();
      }}
      onClose={aoFechar}
      // o fundo escurecido é o próprio <dialog> (a caixa de dentro cobre a largura toda): clicar nele é clicar fora
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="dialog">
        <span id={tituloId} className="dialog-title">
          {titulo}
        </span>
        {children}
      </div>
    </dialog>
  );
}

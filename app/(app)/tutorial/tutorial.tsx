"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ABRIR_TUTORIAL } from "@/lib/eventos";
import type { TelaDoTutorial } from "@/lib/preferencias";
import { usePreferencias } from "../conta";
import { TUTORIAIS } from "./roteiros";

const ATIVO = "data-tutorial-ativo";

/**
 * O tutorial de uma tela (spec 2026-10-15-primeiro-uso, parte 3): um cartão do mascote no canto,
 * que destaca a parte da tela de cada passo. Abre sozinho na primeira visita; "Não mostrar de
 * novo" guarda na conta; o "?" da barra do topo reabre. Não é modal: dá para clicar fora.
 */
export function Tutorial({ tela, atraso = 600 }: { tela: TelaDoTutorial; atraso?: number }) {
  const { carregado, tutorialDispensado, dispensarTutorial } = usePreferencias();
  const { nome, mascote, passos } = TUTORIAIS[tela];
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const cartao = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const titulo = useId();

  function abrir() {
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIndice(0);
    setNaoMostrar(false);
    setAberto(true);
  }

  function fechar() {
    if (naoMostrar) dispensarTutorial(tela);
    setAberto(false);
    focoAnterior.current?.focus?.();
  }

  // o Esc da janela e o "?" chamam sempre a versão atual (com a caixa como está agora)
  const acoes = useRef({ abrir, fechar });
  useEffect(() => {
    acoes.current = { abrir, fechar };
  });

  // primeira visita: abre depois que a tela carregou e as preferências chegaram
  const dispensado = tutorialDispensado(tela);
  useEffect(() => {
    if (!carregado || dispensado) return;
    const timer = setTimeout(() => acoes.current.abrir(), atraso);
    return () => clearTimeout(timer);
    // só quando as preferências chegam: dispensar no meio não reabre nada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado]);

  // o "?" da barra do topo
  useEffect(() => {
    const reabrir = () => acoes.current.abrir();
    window.addEventListener(ABRIR_TUTORIAL, reabrir);
    return () => window.removeEventListener(ABRIR_TUTORIAL, reabrir);
  }, []);

  // Esc com o foco em qualquer lugar da página; dentro de uma janela <dialog>, o Esc é dela
  useEffect(() => {
    if (!aberto) return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
      acoes.current.fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  // destaque do passo atual; sai ao trocar de passo, fechar ou desmontar
  useEffect(() => {
    if (!aberto) return;
    const alvo = document.querySelector<HTMLElement>(`[data-tutorial="${passos[indice].alvo}"]`);
    if (!alvo) return;
    const estatico = getComputedStyle(alvo).position === "static";
    if (estatico) alvo.style.position = "relative";
    alvo.setAttribute(ATIVO, "");
    const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    alvo.scrollIntoView?.({ block: "center", behavior: suave ? "smooth" : "auto" });
    return () => {
      alvo.removeAttribute(ATIVO);
      if (estatico) alvo.style.position = "";
    };
  }, [aberto, indice, passos]);

  useEffect(() => {
    if (aberto) cartao.current?.focus();
  }, [aberto, indice]);

  if (!aberto) return null;
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  return (
    <div
      ref={cartao}
      role="dialog"
      aria-labelledby={titulo}
      tabIndex={-1}
      className="card tutorial"
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        // dentro da janela de Configurações, o Esc fecha só o tutorial, não a janela
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
      }}
    >
      <div className="tutorial-topo">
        <Image src={mascote} alt="" width={52} height={52} className="tutorial-mascote" />
        <span className="tutorial-contagem">{`${nome} · ${indice + 1} de ${passos.length}`}</span>
        <button type="button" className="app-icone-botao" aria-label="Fechar o tutorial" onClick={fechar}>
          <X size={16} />
        </button>
      </div>
      <h2 id={titulo} className="tutorial-titulo">
        {passo.titulo}
      </h2>
      <p className="tutorial-texto">{passo.texto}</p>
      <label className="tutorial-caixa">
        <input type="checkbox" checked={naoMostrar} onChange={(evento) => setNaoMostrar(evento.target.checked)} />
        Não mostrar de novo
      </label>
      <div className="tutorial-acoes">
        <span className="tutorial-pontos" aria-hidden="true">
          {passos.map((item, i) => (
            <span key={item.alvo} data-atual={i === indice || undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-ghost" onClick={fechar}>
          Pular
        </button>
        <button type="button" className="btn btn-primary" onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}>
          {ultimo ? "Entendi" : "Próximo"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ABRIR_TUTORIAL } from "@/lib/eventos";
import type { TelaDoTutorial } from "@/lib/preferencias";
import { usePreferencias } from "../conta";
import { TUTORIAIS, type PassoDoTutorial } from "./roteiros";

const ATIVO = "data-tutorial-ativo";
/** As telas cujo tutorial já abriu sozinho nesta sessão: voltar a uma tela não o reabre. */
const VISTOS = "ledgr:tutoriais-vistos";
/** De quanto em quanto tempo o cartão olha se a tela já mostrou o que ele vai destacar. */
const INTERVALO_MS = 100;

function vistosNestaSessao(): string[] {
  try {
    const lista = JSON.parse(window.sessionStorage.getItem(VISTOS) ?? "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function marcarVisto(tela: TelaDoTutorial) {
  try {
    const lista = vistosNestaSessao();
    if (!lista.includes(tela)) window.sessionStorage.setItem(VISTOS, JSON.stringify([...lista, tela]));
  } catch {
    // sem armazenamento: o cartão pode reabrir ao voltar à tela, nada mais
  }
}

const alvoDe = (passo: PassoDoTutorial) => document.querySelector<HTMLElement>(`[data-tutorial="${passo.alvo}"]`);

/**
 * O tutorial de uma tela (spec 2026-10-15-primeiro-uso, parte 3): um cartão do mascote no canto,
 * que destaca a parte da tela de cada passo. Abre sozinho na primeira visita; "Não mostrar de
 * novo" guarda na conta; o "?" da barra do topo reabre. Não é modal: dá para clicar fora.
 */
export function Tutorial({
  tela,
  atraso = 600,
  espera = 3000,
}: {
  tela: TelaDoTutorial;
  atraso?: number;
  /** Quanto o cartão espera a tela mostrar algum alvo antes de abrir assim mesmo, sem destaque. */
  espera?: number;
}) {
  const { carregado, tutorialDispensado, dispensarTutorial } = usePreferencias();
  const { nome, mascote, passos: todos } = TUTORIAIS[tela];
  // os passos desta abertura: os opcionais só entram se o alvo deles está na tela
  const [passos, setPassos] = useState<PassoDoTutorial[]>(todos);
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const cartao = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const titulo = useId();

  function abrir() {
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPassos(todos.filter((passo) => !passo.opcional || alvoDe(passo)));
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

  // primeira visita na sessão: abre depois que a tela mostrou algum alvo (ou desistiu de esperar)
  const dispensado = tutorialDispensado(tela);
  useEffect(() => {
    if (!carregado || dispensado || vistosNestaSessao().includes(tela)) return;
    const inicio = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tentar = () => {
      if (todos.some((passo) => alvoDe(passo)) || Date.now() - inicio >= espera) {
        marcarVisto(tela);
        acoes.current.abrir();
        return;
      }
      timer = setTimeout(tentar, INTERVALO_MS);
    };
    timer = setTimeout(tentar, atraso);
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

  // destaque do passo atual: espera o alvo aparecer (a tela pode ainda estar carregando) e sai ao
  // trocar de passo, fechar ou desmontar
  useEffect(() => {
    if (!aberto) return;
    const passo = passos[indice];
    const inicio = Date.now();
    let alvo: HTMLElement | null = null;
    let estatico = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const destacar = () => {
      alvo = alvoDe(passo);
      if (!alvo) {
        if (Date.now() - inicio < espera) timer = setTimeout(destacar, INTERVALO_MS);
        return;
      }
      estatico = getComputedStyle(alvo).position === "static";
      if (estatico) alvo.style.position = "relative";
      alvo.setAttribute(ATIVO, "");
      const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      alvo.scrollIntoView?.({ block: "center", behavior: suave ? "smooth" : "auto" });
    };
    destacar();
    return () => {
      clearTimeout(timer);
      if (!alvo) return;
      alvo.removeAttribute(ATIVO);
      if (estatico) alvo.style.position = "";
    };
  }, [aberto, indice, passos, espera]);

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

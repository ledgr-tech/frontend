"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { telaDoCaminho } from "../tutorial/roteiros";
import { colunaRecolhida, definirColuna, temColuna } from "./estado";

type Valor = {
  encaixeAgora: HTMLElement | null;
  encaixeTutorial: HTMLElement | null;
  largas: boolean;
  painelAberto: boolean;
  abrirPainel(): void;
  fecharPainel(): void;
  /** Abre a coluna para o tutorial e devolve o que desfaz só o que ele mudou. */
  mostrarParaTutorial(): () => void;
  pendente: boolean;
  // internos, usados por ColunaAgora e ColunaDaTela
  montadas: number;
  recolhida: boolean;
  alternar(): void;
  refAgora(el: HTMLElement | null): void;
  refTutorial(el: HTMLElement | null): void;
  registrar(pendente: boolean): () => void;
};

const Contexto = createContext<Valor | null>(null);

export function useColuna(): Valor {
  const v = useContext(Contexto);
  if (!v) throw new Error("useColuna fora do ProvedorDaColuna");
  return v;
}

const LARGAS = "(min-width: 1280px)";

export function ProvedorDaColuna({ children }: { children: ReactNode }) {
  const [encaixeAgora, setAgora] = useState<HTMLElement | null>(null);
  const [encaixeTutorial, setTutorial] = useState<HTMLElement | null>(null);
  const [largas, setLargas] = useState(false);
  // o painel guarda em que caminho foi aberto: trocar de tela o fecha sem efeito
  const caminho = usePathname();
  const [painelEm, setPainel] = useState<string | null>(null);
  const painelAberto = painelEm === caminho;
  const [recolhida, setRecolhida] = useState(false);
  const [montadas, setMontadas] = useState(0);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    // o atributo só existe no navegador: lido depois da hidratação para não divergir do HTML do servidor
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecolhida(colunaRecolhida());
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(LARGAS);
    const ler = () => setLargas(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);

  const abrirPainel = useCallback(() => setPainel(caminho), [caminho]);
  const fecharPainel = useCallback(() => setPainel(null), []);

  const alternar = useCallback(() => {
    const nova = !colunaRecolhida();
    definirColuna(nova);
    setRecolhida(nova);
  }, []);

  const mostrarParaTutorial = useCallback(() => {
    if (largas) {
      const estava = colunaRecolhida();
      if (!estava) return () => {};
      definirColuna(false, { gravar: false });
      setRecolhida(false);
      return () => {
        definirColuna(true, { gravar: false });
        setRecolhida(true);
      };
    }
    if (painelAberto) return () => {};
    setPainel(caminho);
    return () => setPainel(null);
  }, [largas, painelAberto, caminho]);

  const registrar = useCallback((pendente: boolean) => {
    setMontadas((n) => n + 1);
    if (pendente) setPendentes((n) => n + 1);
    return () => {
      setMontadas((n) => n - 1);
      if (pendente) setPendentes((n) => n - 1);
    };
  }, []);

  const valor = useMemo<Valor>(
    () => ({
      encaixeAgora, encaixeTutorial, largas, painelAberto, abrirPainel, fecharPainel, mostrarParaTutorial,
      pendente: pendentes > 0, montadas, recolhida, alternar, refAgora: setAgora, refTutorial: setTutorial, registrar,
    }),
    [encaixeAgora, encaixeTutorial, largas, painelAberto, abrirPainel, fecharPainel, mostrarParaTutorial, pendentes, montadas, recolhida, alternar, registrar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function useTemColuna(): boolean {
  const { montadas } = useColuna();
  const tela = telaDoCaminho(usePathname());
  return temColuna(tela) || (tela === "divergencia" && montadas > 0);
}

/** Nas telas menores, abre o "Agora" num painel por cima; fica na barra do topo. */
export function BotaoAgora() {
  const { largas, painelAberto, abrirPainel, fecharPainel, pendente } = useColuna();
  if (!useTemColuna() || largas) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost coluna-botao-agora"
      aria-expanded={painelAberto}
      onClick={painelAberto ? fecharPainel : abrirPainel}
    >
      Agora
      {pendente && <span className="coluna-ponto" aria-hidden="true" />}
    </button>
  );
}

/** A coluna da direita. Na divergência só existe com a Comparação montada embaixo (uma ColunaDaTela). */
export function ColunaAgora() {
  const { recolhida, alternar, refAgora, refTutorial, largas, painelAberto, fecharPainel } = useColuna();
  const existe = useTemColuna();
  const painel = !largas && painelAberto;
  const aside = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!painel) return;
    aside.current?.focus();
    // dentro de uma janela <dialog>, o Esc é dela
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
      fecharPainel();
      document.querySelector<HTMLButtonElement>(".coluna-botao-agora")?.focus();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [painel, fecharPainel]);

  if (!existe) return null;
  return (
    <aside
      ref={aside}
      className="coluna-agora"
      aria-label="O que fazer agora"
      hidden={!largas && !painelAberto}
      tabIndex={painel ? -1 : undefined}
      role={painel ? "dialog" : undefined}
      data-painel={painel ? "aberto" : undefined}
    >
      {painel ? (
        <button
          type="button"
          className="app-icone-botao coluna-agora-fechar"
          aria-label="Fechar"
          onClick={() => {
            fecharPainel();
            document.querySelector<HTMLButtonElement>(".coluna-botao-agora")?.focus();
          }}
        >
          <X size={18} aria-hidden />
        </button>
      ) : (
        <button type="button" className="coluna-agora-alternar btn btn-ghost" onClick={alternar}>
          {recolhida ? "Abrir a coluna" : "Recolher a coluna"}
        </button>
      )}
      <div className="coluna-agora-corpo">
        <div ref={refAgora} />
        <div ref={refTutorial} />
        <div className="coluna-agora-ajuda" />
      </div>
    </aside>
  );
}

/** O "Agora" de uma tela: vai para dentro da coluna. `pendente` = a tela ainda carrega e o Agora não sabe o que dizer. */
export function ColunaDaTela({ children, pendente = false }: { children: ReactNode; pendente?: boolean }) {
  const { encaixeAgora, registrar } = useColuna();
  useEffect(() => registrar(pendente), [registrar, pendente]);
  return encaixeAgora ? createPortal(children, encaixeAgora) : null;
}

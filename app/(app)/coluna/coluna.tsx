"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
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
  const [painelAberto, setPainel] = useState(false);
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

  const abrirPainel = useCallback(() => setPainel(true), []);
  const fecharPainel = useCallback(() => setPainel(false), []);

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
    setPainel(true);
    return () => setPainel(false);
  }, [largas, painelAberto]);

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

/** A coluna da direita. Na divergência só existe com a Comparação montada embaixo (uma ColunaDaTela). */
export function ColunaAgora() {
  const { montadas, recolhida, alternar, refAgora, refTutorial } = useColuna();
  const tela = telaDoCaminho(usePathname());
  const existe = temColuna(tela) || (tela === "divergencia" && montadas > 0);
  if (!existe) return null;
  return (
    <aside className="coluna-agora" aria-label="O que fazer agora">
      <button type="button" className="coluna-agora-alternar btn btn-ghost" onClick={alternar}>
        {recolhida ? "Abrir a coluna" : "Recolher a coluna"}
      </button>
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

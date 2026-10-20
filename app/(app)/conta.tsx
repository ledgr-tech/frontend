"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { salvarPreferencias } from "../(auth)/acoes";
import {
  guardarLocal,
  juntar,
  PREFERENCIAS_VAZIAS,
  preferenciasLocais,
  type Preferencias,
  type TelaDoTutorial,
} from "@/lib/preferencias";
import type { Assinatura } from "@/lib/assinatura";

type ValorDaConta = {
  /** Falso até ler o navegador: antes disso, ninguém abre tutorial nem roteiro. */
  carregado: boolean;
  tutorialDispensado: (tela: TelaDoTutorial) => boolean;
  dispensarTutorial: (tela: TelaDoTutorial) => void;
  roteiroDispensado: boolean;
  dispensarRoteiro: () => void;
};

const Contexto = createContext<ValorDaConta | null>(null);
/** Quem é o gestor da conta (o administrador, #168); fora do app, como a conta única antiga, sim. */
const ContextoDoGestor = createContext(true);
/** O plano e o teste de 14 dias; null sem a informação do backend (e fora do app). */
const ContextoDaAssinatura = createContext<Assinatura | null>(null);

/**
 * As preferências do primeiro uso (spec 2026-10-15-primeiro-uso): as da conta, do `GET /me`,
 * somadas às do navegador. Dispensar guarda nos dois; se o backend ainda não tem a rota, o
 * navegador basta.
 */
export function ProvedorDaConta({
  preferencias,
  assinatura = null,
  administrador = true,
  children,
}: {
  preferencias: Preferencias | null;
  assinatura?: Assinatura | null;
  /** Do `GET /me`: só o gestor justifica e fecha o mês. */
  administrador?: boolean;
  children: ReactNode;
}) {
  const [atuais, setAtuais] = useState<Preferencias>(preferencias ?? PREFERENCIAS_VAZIAS);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // localStorage só existe no cliente; ler fora do render é o padrão do projeto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAtuais((anteriores) => juntar(anteriores, preferenciasLocais()));
    setCarregado(true);
  }, []);

  const guardar = useCallback((novas: Preferencias) => {
    setAtuais(novas);
    guardarLocal(novas);
    void salvarPreferencias(novas).catch(() => false);
  }, []);

  const valor = useMemo<ValorDaConta>(
    () => ({
      carregado,
      tutorialDispensado: (tela) => atuais.tutoriaisDispensados.includes(tela),
      dispensarTutorial: (tela) =>
        guardar({ ...atuais, tutoriaisDispensados: [...new Set([...atuais.tutoriaisDispensados, tela])] }),
      roteiroDispensado: atuais.roteiroDispensado,
      dispensarRoteiro: () => guardar({ ...atuais, roteiroDispensado: true }),
    }),
    [atuais, carregado, guardar],
  );

  return (
    <Contexto.Provider value={valor}>
      <ContextoDaAssinatura.Provider value={assinatura}>
        <ContextoDoGestor.Provider value={administrador}>{children}</ContextoDoGestor.Provider>
      </ContextoDaAssinatura.Provider>
    </Contexto.Provider>
  );
}

export function usePreferencias(): ValorDaConta {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("usePreferencias fora do ProvedorDaConta");
  return valor;
}

export function useAssinatura(): Assinatura | null {
  return useContext(ContextoDaAssinatura);
}

/** Se quem está na tela é o gestor da conta, que justifica e fecha o mês (#168). */
export function useEhGestor(): boolean {
  return useContext(ContextoDoGestor);
}

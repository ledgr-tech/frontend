"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { salvarPreferencias } from "../../../(auth)/acoes";
import {
  guardarLocal,
  juntar,
  PREFERENCIAS_VAZIAS,
  preferenciasLocais,
  type Preferencias,
  type TelaDoTutorial,
} from "@/lib/preferencias";
import type { Assinatura } from "@/lib/assinatura";
import type { LimitesDaConta } from "@/lib/limites";
import { podeFecharMes, type Papel } from "@/lib/papel";

type ValorDaConta = {
  /** Falso até ler o navegador: antes disso, ninguém abre tutorial nem roteiro. */
  carregado: boolean;
  tutorialDispensado: (tela: TelaDoTutorial) => boolean;
  dispensarTutorial: (tela: TelaDoTutorial) => void;
  roteiroDispensado: boolean;
  dispensarRoteiro: () => void;
};

const Contexto = createContext<ValorDaConta | null>(null);
/** O papel de quem está na tela (#133); fora do app, como a conta única antiga, admin. */
const ContextoDoPapel = createContext<Papel>("admin");
/** O plano e o teste de 14 dias; null sem a informação do backend (e fora do app). */
const ContextoDaAssinatura = createContext<Assinatura | null>(null);
/** Quanto do plano a conta usa; null sem a informação do backend (e fora do app): nenhum aviso. */
const ContextoDosLimites = createContext<LimitesDaConta | null>(null);
/** O e-mail de quem está logado (a sessão), para marcar a própria linha na Equipe; vazio fora do app. */
const ContextoDoEmail = createContext("");
/** O nome de quem está logado, do `GET /me`: só quem aprovou desfaz a aprovação (backend #164); vazio fora do app. */
const ContextoDoNome = createContext("");
/** Se a conta tem senha (`metodos_login` do `GET /me`): a transferência da administração a pede, como a desativação. */
const ContextoDaSenha = createContext(true);
/** Se a conta guarda o original de cada extrato (backend #139, plano avançado): o painel de Extratos avisa quando um não foi guardado. */
const ContextoDoOriginal = createContext(false);

/**
 * As preferências do primeiro uso (spec 2026-10-15-primeiro-uso): as da conta, do `GET /me`,
 * somadas às do navegador. Dispensar guarda nos dois; se o backend ainda não tem a rota, o
 * navegador basta.
 */
export function ProvedorDaConta({
  preferencias,
  assinatura = null,
  limites = null,
  papel = "admin",
  email = "",
  nome = "",
  temSenha = true,
  guardaArquivoOriginal = false,
  children,
}: {
  preferencias: Preferencias | null;
  assinatura?: Assinatura | null;
  /** Do `GET /me`: os limites do plano para os avisos de empresas e pessoas. */
  limites?: LimitesDaConta | null;
  /** O e-mail da sessão. */
  email?: string;
  /** O nome de quem está logado, do `GET /me`. */
  nome?: string;
  /** Falso na conta que só entra pelo Google. */
  temSenha?: boolean;
  /** Do `GET /me`: só o admin e o gestor fecham o mês. */
  papel?: Papel;
  /** Do `GET /me`: a conta guarda o original de cada extrato. */
  guardaArquivoOriginal?: boolean;
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
        <ContextoDosLimites.Provider value={limites}>
          <ContextoDoPapel.Provider value={papel}>
            <ContextoDoEmail.Provider value={email}>
              <ContextoDoNome.Provider value={nome}>
                <ContextoDaSenha.Provider value={temSenha}>
                  <ContextoDoOriginal.Provider value={guardaArquivoOriginal}>{children}</ContextoDoOriginal.Provider>
                </ContextoDaSenha.Provider>
              </ContextoDoNome.Provider>
            </ContextoDoEmail.Provider>
          </ContextoDoPapel.Provider>
        </ContextoDosLimites.Provider>
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

export function useTemSenha(): boolean {
  return useContext(ContextoDaSenha);
}

export function useGuardaArquivoOriginal(): boolean {
  return useContext(ContextoDoOriginal);
}

export function useEmail(): string {
  return useContext(ContextoDoEmail);
}

export function useNome(): string {
  return useContext(ContextoDoNome);
}

export function useLimites(): LimitesDaConta | null {
  return useContext(ContextoDosLimites);
}

export function usePapel(): Papel {
  return useContext(ContextoDoPapel);
}

/** Se quem está na tela fecha e reabre o mês: o admin e o gestor (#168). */
export function usePodeFechar(): boolean {
  return podeFecharMes(useContext(ContextoDoPapel));
}

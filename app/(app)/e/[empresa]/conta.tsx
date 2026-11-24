"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { salvarPreferencias } from "../../../(auth)/acoes";
import {
  guardarLocal,
  juntar,
  PREFERENCIAS_VAZIAS,
  preferenciasLocais,
  TELAS_DO_TUTORIAL,
  type Preferencias,
  type TelaDoTutorial,
} from "@/lib/preferencias";
import type { Assinatura } from "@/lib/assinatura";
import type { LimitesDaConta } from "@/lib/limites";
import { podeFecharMes, type Papel } from "@/lib/papel";

type ValorDaConta = {
  /** Falso até ler o navegador: antes disso, ninguém abre tutorial nem roteiro. */
  carregado: boolean;
  /** O tutorial da tela já abriu uma vez (ou foi dispensado): não abre mais sozinho. */
  tutorialDispensado: (tela: TelaDoTutorial) => boolean;
  dispensarTutorial: (tela: TelaDoTutorial) => void;
  /** "Não mostrar mais tutoriais": nenhum abre sozinho, em tela nenhuma. */
  dispensarTodosOsTutoriais: () => void;
  roteiroDispensado: boolean;
  dispensarRoteiro: () => void;
  boasVindasVista: boolean;
  marcarBoasVindasVista: () => void;
};

const Contexto = createContext<ValorDaConta | null>(null);
/** O papel de quem está na tela (#133); fora do app, como a conta única antiga, admin. */
const ContextoDoPapel = createContext<Papel>("admin");
/** O plano e o teste de 14 dias; null sem a informação do backend (e fora do app). */
const ContextoDaAssinatura = createContext<Assinatura | null>(null);
/** Se a cobrança está ligada (`cobranca_habilitada` do `GET /me`); desligada, nada de plano ou assinatura aparece. */
const ContextoDaCobranca = createContext(false);
/** Quanto do plano a conta usa; null sem a informação do backend (e fora do app): nenhum aviso. */
const ContextoDosLimites = createContext<LimitesDaConta | null>(null);
/** O e-mail de quem está logado (a sessão), para a Equipe e o primeiro uso; vazio fora do app. */
const ContextoDoEmail = createContext("");
/** O nome de quem está logado, do `GET /me`: só quem aprovou desfaz a aprovação (backend #164); vazio fora do app. */
const ContextoDoNome = createContext("");
/** Se a conta tem senha (`metodos_login` do `GET /me`): a transferência da administração a pede, como a desativação. */
const ContextoDaSenha = createContext(true);
/** Se a conta guarda o original de cada extrato (backend #139, plano avançado): o painel de Extratos avisa quando um não foi guardado. */
const ContextoDoOriginal = createContext(false);
/** Se a integração com o sistema de gestão está ligada no backend (`integracao_sistema_habilitada`, #253); falso quando falta. */
const ContextoIntegracaoHabilitada = createContext(false);
/** Se a empresa ativa já configurou a integração (`integracao_sistema_configurada`, #253); falso quando falta. */
const ContextoIntegracaoConfigurada = createContext(false);

/**
 * As preferências do primeiro uso (spec 2026-10-15-primeiro-uso): as da conta, do `GET /me`,
 * somadas às do mesmo e-mail no navegador. Dispensar guarda nos dois; se o backend ainda não
 * tem a rota, o navegador basta.
 */
export function ProvedorDaConta({
  preferencias,
  assinatura = null,
  cobrancaHabilitada = false,
  limites = null,
  papel = "admin",
  email = "",
  nome = "",
  temSenha = true,
  guardaArquivoOriginal = false,
  integracaoSistemaHabilitada = false,
  integracaoSistemaConfigurada = false,
  children,
}: {
  preferencias: Preferencias | null;
  assinatura?: Assinatura | null;
  cobrancaHabilitada?: boolean;
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
  /** Do `GET /me`: a integração com sistema de gestão está habilitada no servidor (#253). */
  integracaoSistemaHabilitada?: boolean;
  /** Do `GET /me`: a empresa ativa já configurou a integração com o sistema (#253). */
  integracaoSistemaConfigurada?: boolean;
  children: ReactNode;
}) {
  const dono = email.toLowerCase();
  const [locais, setLocais] = useState<{ dono: string; preferencias: Preferencias } | null>(null);
  const carregado = locais?.dono === dono;
  const atuais = useMemo(() => {
    const daConta = preferencias ?? PREFERENCIAS_VAZIAS;
    return carregado ? juntar(daConta, locais.preferencias) : daConta;
  }, [preferencias, carregado, locais]);

  useEffect(() => {
    // Ao trocar de pessoa, espera a leitura do novo e-mail antes de liberar o primeiro uso.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocais({ dono, preferencias: preferenciasLocais(dono) });
  }, [dono]);

  // duas gravações antes do próximo render (as boas-vindas marcam o tutorial e a janela) somam,
  // em vez de a segunda partir do `atuais` antigo e apagar a primeira
  const pendente = useRef<{ base: Preferencias; novas: Preferencias } | null>(null);
  const guardar = useCallback((mudar: (anteriores: Preferencias) => Preferencias) => {
    const anteriores = pendente.current?.base === atuais ? pendente.current.novas : atuais;
    const novas = mudar(anteriores);
    pendente.current = { base: atuais, novas };
    setLocais({ dono, preferencias: novas });
    guardarLocal(dono, novas);
    void salvarPreferencias(novas).catch(() => false);
  }, [dono, atuais]);

  const valor = useMemo<ValorDaConta>(
    () => ({
      carregado,
      tutorialDispensado: (tela) => atuais.tutoriaisDispensados.includes(tela),
      dispensarTutorial: (tela) =>
        guardar((p) => ({ ...p, tutoriaisDispensados: [...new Set([...p.tutoriaisDispensados, tela])] })),
      dispensarTodosOsTutoriais: () => guardar((p) => ({ ...p, tutoriaisDispensados: [...TELAS_DO_TUTORIAL] })),
      roteiroDispensado: atuais.roteiroDispensado,
      dispensarRoteiro: () => guardar((p) => ({ ...p, roteiroDispensado: true })),
      // quem já passou pela Visão geral não está na primeira entrada: não ganha a janela. Só ela conta:
      // abrir o tutorial de outra tela (quem chega por convite ou link) já a põe na lista
      boasVindasVista:
        atuais.boasVindasVista === true || atuais.roteiroDispensado || atuais.tutoriaisDispensados.includes("visao-geral"),
      marcarBoasVindasVista: () => guardar((p) => ({ ...p, boasVindasVista: true })),
    }),
    [atuais, carregado, guardar],
  );

  return (
    <Contexto.Provider value={valor}>
      <ContextoDaAssinatura.Provider value={assinatura}>
        <ContextoDaCobranca.Provider value={cobrancaHabilitada}>
          <ContextoDosLimites.Provider value={limites}>
            <ContextoDoPapel.Provider value={papel}>
              <ContextoDoEmail.Provider value={email}>
                <ContextoDoNome.Provider value={nome}>
                  <ContextoDaSenha.Provider value={temSenha}>
                    <ContextoDoOriginal.Provider value={guardaArquivoOriginal}>
                      <ContextoIntegracaoHabilitada.Provider value={integracaoSistemaHabilitada}>
                        <ContextoIntegracaoConfigurada.Provider value={integracaoSistemaConfigurada}>
                          {children}
                        </ContextoIntegracaoConfigurada.Provider>
                      </ContextoIntegracaoHabilitada.Provider>
                    </ContextoDoOriginal.Provider>
                  </ContextoDaSenha.Provider>
                </ContextoDoNome.Provider>
              </ContextoDoEmail.Provider>
            </ContextoDoPapel.Provider>
          </ContextoDosLimites.Provider>
        </ContextoDaCobranca.Provider>
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

/** Se há planos e assinatura para mostrar: os atalhos "Ver planos" e a tela Assinatura dependem disto. */
export function useCobranca(): boolean {
  return useContext(ContextoDaCobranca);
}

export function useTemSenha(): boolean {
  return useContext(ContextoDaSenha);
}

export function useGuardaArquivoOriginal(): boolean {
  return useContext(ContextoDoOriginal);
}

/** Se a integração com sistema de gestão está ligada no backend (`integracao_sistema_habilitada`, #253). */
export function useIntegracaoSistemaHabilitada(): boolean {
  return useContext(ContextoIntegracaoHabilitada);
}

/** Se a empresa ativa já configurou a integração com o sistema (`integracao_sistema_configurada`, #253). */
export function useIntegracaoSistemaConfigurada(): boolean {
  return useContext(ContextoIntegracaoConfigurada);
}

/** Os dois estados da integração com o sistema na empresa ativa; ambos falsos quando o campo falta. */
export function useIntegracaoSistema(): { habilitada: boolean; configurada: boolean } {
  return {
    habilitada: useContext(ContextoIntegracaoHabilitada),
    configurada: useContext(ContextoIntegracaoConfigurada),
  };
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

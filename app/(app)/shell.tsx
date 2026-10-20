"use client";

import type { ReactNode } from "react";
import { LucideProvider } from "lucide-react";
import { sair } from "../(auth)/acoes";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";
import { EmpresaDaSessao } from "./cabecalho";
import { TRACO_ICONE } from "./traco-icone";
import { ProvedorDaConta } from "./conta";
import { TutorialDaRota } from "./tutorial/tutorial-da-rota";
import { PainelDaRota } from "./ajuda/painel-de-ajuda";
import type { Preferencias } from "@/lib/preferencias";
import type { Assinatura } from "@/lib/assinatura";

export function Shell({
  email,
  empresa,
  temSenha,
  administrador,
  preferencias,
  assinatura = null,
  children,
}: {
  email: string;
  empresa: string;
  temSenha: boolean;
  /** Quem cadastrou a empresa; vai até a seção Equipe das Configurações. */
  administrador: boolean;
  /** O que a pessoa dispensou no primeiro uso, do `GET /me`; null quando ele não manda. */
  preferencias: Preferencias | null;
  /** O plano e o teste de 14 dias, do `GET /me`; null quando ele não manda. */
  assinatura?: Assinatura | null;
  children: ReactNode;
}) {
  return (
    <EmpresaDaSessao value={empresa}>
      <ProvedorDaConta preferencias={preferencias} assinatura={assinatura} administrador={administrador}>
        <LucideProvider strokeWidth={TRACO_ICONE}>
          <div className="app-shell">
            <MenuLateral
              email={email}
              empresa={empresa}
              temSenha={temSenha}
              administrador={administrador}
              onSair={() => void sair()}
            />
            <main className="app-principal">
              <BarraSuperior />
              <div className="app-conteudo">{children}</div>
              <TutorialDaRota />
              <PainelDaRota />
            </main>
          </div>
        </LucideProvider>
      </ProvedorDaConta>
    </EmpresaDaSessao>
  );
}

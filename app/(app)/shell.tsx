"use client";

import type { ReactNode } from "react";
import { LucideProvider } from "lucide-react";
import { sair } from "../(auth)/acoes";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";
import { EmpresaDaSessao } from "./cabecalho";
import { TRACO_ICONE } from "./traco-icone";
import { ProvedorDaConta } from "./conta";
import type { Preferencias } from "@/lib/preferencias";

export function Shell({
  email,
  empresa,
  temSenha,
  preferencias,
  children,
}: {
  email: string;
  empresa: string;
  temSenha: boolean;
  /** O que a pessoa dispensou no primeiro uso, do `GET /me`; null quando ele não manda. */
  preferencias: Preferencias | null;
  children: ReactNode;
}) {
  return (
    <EmpresaDaSessao value={empresa}>
      <ProvedorDaConta preferencias={preferencias}>
        <LucideProvider strokeWidth={TRACO_ICONE}>
          <div className="app-shell">
            <MenuLateral
              email={email}
              empresa={empresa}
              temSenha={temSenha}
              onSair={() => void sair()}
            />
            <main className="app-principal">
              <BarraSuperior />
              <div className="app-conteudo">{children}</div>
            </main>
          </div>
        </LucideProvider>
      </ProvedorDaConta>
    </EmpresaDaSessao>
  );
}

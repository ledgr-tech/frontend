"use client";

import type { ReactNode } from "react";
import { LucideProvider } from "lucide-react";
import { sair } from "../(auth)/acoes";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";
import { EmpresaDaSessao } from "./cabecalho";
import { TRACO_ICONE } from "./traco-icone";

export function Shell({
  email,
  empresa,
  temSenha,
  children,
}: {
  email: string;
  empresa: string;
  temSenha: boolean;
  children: ReactNode;
}) {
  return (
    <EmpresaDaSessao value={empresa}>
      <LucideProvider strokeWidth={TRACO_ICONE}>
        <div className="app-shell">
          <MenuLateral email={email} empresa={empresa} temSenha={temSenha} onSair={() => void sair()} />
          <main className="app-principal">
            <BarraSuperior />
            <div className="app-conteudo">{children}</div>
          </main>
        </div>
      </LucideProvider>
    </EmpresaDaSessao>
  );
}

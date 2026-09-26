"use client";

import type { ReactNode } from "react";
import { sair } from "../(auth)/acoes";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";

export function Shell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="app-shell">
      <MenuLateral email={email} onSair={() => void sair()} />
      <main className="app-principal">
        <BarraSuperior />
        <div className="app-conteudo">{children}</div>
      </main>
    </div>
  );
}

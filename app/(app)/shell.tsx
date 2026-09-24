"use client";

import { useEffect, useState, type ReactNode } from "react";
import { avisosLidos, marcarAvisosLidos } from "@/lib/mock-data";
import { sair } from "../(auth)/acoes";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";

export function Shell({ email, children }: { email: string; children: ReactNode }) {
  const [avisoNaoLido, setAvisoNaoLido] = useState(false);

  // localStorage só existe no cliente; ler fora da fase de render é o padrão.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvisoNaoLido(!avisosLidos());
  }, []);

  function marcarLidos() {
    marcarAvisosLidos();
    setAvisoNaoLido(false);
  }

  return (
    <div className="app-shell">
      <MenuLateral email={email} onSair={() => void sair()} />
      <main className="app-principal">
        <BarraSuperior avisoNaoLido={avisoNaoLido} onMarcarAvisosLidos={marcarLidos} />
        <div className="app-conteudo">{children}</div>
      </main>
    </div>
  );
}

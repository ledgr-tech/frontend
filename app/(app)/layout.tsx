"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getSession, logout } from "@/lib/auth";
import { avisosLidos, marcarAvisosLidos } from "@/lib/mock-data";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [avisoNaoLido, setAvisoNaoLido] = useState(false);

  useEffect(() => {
    const sessao = getSession();
    if (!sessao) {
      router.replace("/login");
      return;
    }
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(sessao.email);
  }, [router]);

  // Efeito separado, e de propósito sem dependências: o de cima reroda quando o
  // router muda de identidade, e junto ele releria o "já li" do localStorage,
  // desfazendo o clique em "Marcar como lidos".
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvisoNaoLido(!avisosLidos());
  }, []);

  if (email === null) {
    return null;
  }

  function sair() {
    logout();
    router.replace("/login");
  }

  function marcarLidos() {
    marcarAvisosLidos();
    setAvisoNaoLido(false);
  }

  return (
    <div className="app-shell">
      <MenuLateral temAvisoNaoLido={avisoNaoLido} />
      <main className="app-principal">
        <BarraSuperior
          email={email}
          avisoNaoLido={avisoNaoLido}
          onMarcarAvisosLidos={marcarLidos}
          onSair={sair}
        />
        <div className="app-conteudo">{children}</div>
      </main>
    </div>
  );
}

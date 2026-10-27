"use client";

import type { ReactNode } from "react";
import { LucideProvider } from "lucide-react";
import { sair } from "../../../(auth)/acoes";
import { MenuLateral } from "./menu-lateral";
import { BarraSuperior } from "./barra-superior";
import { EmpresaDaSessao } from "./cabecalho";
import { TRACO_ICONE } from "./traco-icone";
import { ProvedorDaConta } from "./conta";
import { TutorialDaRota } from "./tutorial/tutorial-da-rota";
import { PainelDaRota } from "./ajuda/painel-de-ajuda";
import type { Preferencias } from "@/lib/preferencias";
import type { Assinatura } from "@/lib/assinatura";
import type { LimitesDaConta } from "@/lib/limites";
import type { Papel } from "@/lib/papel";

export function Shell({
  email,
  empresa,
  nomeDaConta,
  temSenha,
  papel,
  preferencias,
  assinatura = null,
  limites = null,
  guardaArquivoOriginal = false,
  children,
}: {
  email: string;
  /** A razão social da empresa ativa: é a que as telas mostram no cabeçalho. */
  empresa: string;
  /** O nome da conta (o escritório), no cartão do usuário; sem ele, o da empresa, como antes. */
  nomeDaConta?: string;
  temSenha: boolean;
  /** O papel de quem está logado, do `GET /me`; decide o que a tela Empresas e as Configurações oferecem. */
  papel: Papel;
  /** O que a pessoa dispensou no primeiro uso, do `GET /me`; null quando ele não manda. */
  preferencias: Preferencias | null;
  /** O plano e o teste de 14 dias, do `GET /me`; null quando ele não manda. */
  assinatura?: Assinatura | null;
  /** Os limites do plano, do `GET /me`; null quando ele não manda. */
  limites?: LimitesDaConta | null;
  /** Se a conta guarda o original de cada extrato, do `GET /me` (backend #139). */
  guardaArquivoOriginal?: boolean;
  children: ReactNode;
}) {
  return (
    <EmpresaDaSessao value={empresa}>
      <ProvedorDaConta
        preferencias={preferencias}
        assinatura={assinatura}
        limites={limites}
        papel={papel}
        email={email}
        temSenha={temSenha}
        guardaArquivoOriginal={guardaArquivoOriginal}
      >
        <LucideProvider strokeWidth={TRACO_ICONE}>
          <div className="app-shell">
            <MenuLateral
              email={email}
              empresa={nomeDaConta ?? empresa}
              temSenha={temSenha}
              papel={papel}
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

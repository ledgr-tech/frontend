"use client";

import { useTransition, type ReactNode } from "react";
import Link from "@/lib/link-do-app";
import { useRoteador } from "@/lib/roteador";
import { TelaDeAviso } from "@/app/tela-de-aviso";

const SUPORTE = (
  <>
    Se continuar, escreva para <a href="mailto:ledgrtech@gmail.com">ledgrtech@gmail.com</a>.
  </>
);

/** Sem status, a Server Action nem respondeu: para a pessoa, é o mesmo que o servidor fora. */
export function causaDaFalha(status?: number): { texto: ReactNode; mascote: "neutro" | "tomadas" } {
  if (status === 429) {
    return { texto: "Foram muitos pedidos seguidos. Espere um minuto e tente de novo. Nenhum dado foi alterado.", mascote: "neutro" };
  }
  if (status === undefined || status === 0 || status >= 500) {
    return { texto: <>O Ledgr não conseguiu falar com o servidor agora. Nenhum dado foi alterado. {SUPORTE}</>, mascote: "tomadas" };
  }
  return { texto: <>O pedido não deu certo desta vez. Nenhum dado foi alterado. {SUPORTE}</>, mascote: "neutro" };
}

/**
 * Uma tela inteira que não carregou, com a causa e o que fazer. Por padrão, "Tentar de novo" relê a página
 * no servidor sem recarregar o navegador; a tela que carrega no cliente passa o próprio `tentar`.
 */
export function FalhaAoCarregar({
  oQue,
  status,
  texto,
  tentar,
  voltar = { href: "/visao-geral", rotulo: "Ir para a visão geral" },
  nivel = "h2",
}: {
  /** "os fechamentos": completa "Não foi possível carregar". */
  oQue: string;
  status?: number;
  /** No lugar do texto da causa, quando a tela tem um melhor. */
  texto?: ReactNode;
  tentar?: () => void;
  /** `null` onde o link não levaria a lugar novo. */
  voltar?: { href: string; rotulo: string } | null;
  nivel?: "h1" | "h2";
}) {
  const router = useRoteador();
  const [tentando, iniciar] = useTransition();
  const causa = causaDaFalha(status);
  return (
    <div role="alert">
      <TelaDeAviso titulo={`Não foi possível carregar ${oQue}.`} texto={texto ?? causa.texto} mascote={causa.mascote} nivel={nivel}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={tentando}
          onClick={() => (tentar ? tentar() : iniciar(() => router.refresh()))}
        >
          {tentando ? "Tentando…" : "Tentar de novo"}
        </button>
        {voltar && (
          <Link href={voltar.href} className="btn btn-secondary">
            {voltar.rotulo}
          </Link>
        )}
      </TelaDeAviso>
    </div>
  );
}

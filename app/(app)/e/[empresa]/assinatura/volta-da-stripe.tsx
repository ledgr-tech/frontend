"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NOME_DO_PLANO } from "@/lib/assinatura";
import { useRoteador } from "@/lib/roteador";
import { useAssinatura } from "../conta";

const INTERVALO_MS = 3000;
const ESPERA_MS = 30_000;

/**
 * A volta do checkout (`?checkout=sucesso` ou `cancelado`). Quem libera é o webhook, não a volta: com
 * `sucesso`, a tela relê o `GET /me` a cada 3 s até a conta virar `ativo`, e desiste em 30 s dizendo
 * que pode demorar. A query sai da URL na hora, para o recarregar não repetir a mensagem.
 */
export function VoltaDaStripe() {
  const busca = useSearchParams();
  const [volta] = useState(() => busca.get("checkout"));
  const assinatura = useAssinatura();
  const { refresh } = useRoteador();
  const [demorou, setDemorou] = useState(false);
  const cobranca = assinatura?.situacao === "ativo" ? assinatura.cobranca : null;
  const confirmada = cobranca !== null;

  useEffect(() => {
    if (volta) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [volta]);

  useEffect(() => {
    if (volta !== "sucesso" || confirmada || demorou) return;
    const releitura = setInterval(refresh, INTERVALO_MS);
    const desistir = setTimeout(() => setDemorou(true), ESPERA_MS);
    return () => {
      clearInterval(releitura);
      clearTimeout(desistir);
    };
  }, [volta, confirmada, demorou, refresh]);

  if (volta === "cancelado") return <Aviso>Você voltou sem assinar. Nada foi cobrado.</Aviso>;
  if (volta !== "sucesso") return null;
  if (cobranca) return <Aviso>Assinatura confirmada: plano {NOME_DO_PLANO[cobranca.plano]}, {cobranca.periodo}.</Aviso>;
  return (
    <Aviso>
      {demorou
        ? "A Stripe ainda não confirmou o pagamento. Isso pode levar alguns minutos; esta tela mostra quando confirmar."
        : "Confirmando seu pagamento…"}
    </Aviso>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="aviso-demonstracao">
      {children}
    </p>
  );
}

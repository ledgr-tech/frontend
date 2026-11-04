"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NOME_DO_PLANO } from "@/lib/assinatura";
import { useRoteador } from "@/lib/roteador";
import { useAssinatura } from "../conta";
import { ComemoracaoDaAssinatura } from "./comemoracao";

const INTERVALO_MS = 3000;
// depois dos 30 s, segue relendo mais devagar: o texto promete que a tela mostra quando confirmar
const INTERVALO_LENTO_MS = 15_000;
const ESPERA_MS = 30_000;

/**
 * A volta do checkout (`?checkout=sucesso` ou `cancelado`). Quem libera é o webhook, não a volta: com
 * `sucesso`, a tela relê o `GET /me` a cada 3 s até a conta ter a cobrança (`ativo` ou
 * `pagamento_pendente`); depois de 30 s diz que pode demorar e segue relendo a cada 15 s. A query sai
 * da URL logo, para o recarregar não repetir a mensagem. Confirmada com a conta `ativo`, abre a
 * comemoração (#300) uma vez: ela só existe nesta volta, e recarregar já não traz o `sucesso`.
 */
export function VoltaDaStripe() {
  const busca = useSearchParams();
  const [volta] = useState(() => busca.get("checkout"));
  const assinatura = useAssinatura();
  const { refresh } = useRoteador();
  const [demorou, setDemorou] = useState(false);
  const [comemorando, setComemorando] = useState(true);
  const assinando = assinatura?.situacao === "ativo" || assinatura?.situacao === "pagamento_pendente";
  const cobranca = assinando ? assinatura.cobranca : null;
  const confirmada = cobranca !== null;

  useEffect(() => {
    if (!volta) return;
    // depois do mount: o efeito do roteador do Next roda depois deste e regravaria a URL com a query
    const limpar = setTimeout(() => window.history.replaceState(window.history.state, "", window.location.pathname));
    return () => clearTimeout(limpar);
  }, [volta]);

  useEffect(() => {
    if (volta !== "sucesso" || confirmada) return;
    const releitura = setInterval(refresh, demorou ? INTERVALO_LENTO_MS : INTERVALO_MS);
    const desistir = demorou ? undefined : setTimeout(() => setDemorou(true), ESPERA_MS);
    return () => {
      clearInterval(releitura);
      clearTimeout(desistir);
    };
  }, [volta, confirmada, demorou, refresh]);

  if (volta === "cancelado") return <Aviso>Você voltou sem assinar. Nada foi cobrado.</Aviso>;
  if (volta !== "sucesso") return null;
  if (cobranca) {
    return (
      <>
        {/* com o pagamento pendente, a cobrança existe mas não passou: não há o que comemorar */}
        {comemorando && assinatura?.situacao === "ativo" && (
          <ComemoracaoDaAssinatura cobranca={cobranca} aoFechar={() => setComemorando(false)} />
        )}
        <Aviso>
          Assinatura confirmada: plano {NOME_DO_PLANO[cobranca.plano]}, {cobranca.periodo}.
        </Aviso>
      </>
    );
  }
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

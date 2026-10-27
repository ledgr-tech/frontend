"use client";

import { useEffect, useState } from "react";
import { useRoteador } from "@/lib/roteador";
import { carregarVisaoGeral } from "../conciliacoes/acoes";
import { Conversa, TopoDoLedgr } from "./conversa";
import { montarContexto, type Contexto } from "./respostas";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "falhou" }
  | { situacao: "vazio" }
  | { situacao: "pronto"; contexto: Contexto };

/**
 * "Fale com o Ledgr" como no design: um painel que abre ao lado do cartão do
 * menu, não uma tela. Vive no menu, que é do layout, então continua aberto
 * quando um link da conversa leva a outra tela. Lê o mesmo que a visão geral (a
 * última conciliação) cada vez que abre; sem ela, a conversa fica só com as dúvidas
 * de uso, que vão ao assistente da Central (#172).
 */
export function PainelAssistente({ id, onFechar }: { id: string; onFechar: () => void }) {
  const router = useRoteador();
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });

  useEffect(() => {
    let vivo = true;
    carregarVisaoGeral()
      .then((resposta) => {
        if (!vivo) return;
        if (!resposta.ok && resposta.status === 401) {
          router.push("/login");
          return;
        }
        if (!resposta.ok) {
          setEstado({ situacao: "falhou" });
          return;
        }
        const contexto = montarContexto(resposta.dados);
        setEstado(contexto ? { situacao: "pronto", contexto } : { situacao: "vazio" });
      })
      // a Server Action lançou (rede, deploy novo no meio) em vez de devolver um Resultado
      .catch(() => vivo && setEstado({ situacao: "falhou" }));
    return () => {
      vivo = false;
    };
  }, [router]);

  return (
    // não modal: dá para ler a conversa e mexer na tela ao lado ao mesmo tempo
    <section
      id={id}
      className="asst-painel"
      role="dialog"
      aria-label="Fale com o Ledgr"
      onKeyDown={(evento) => evento.key === "Escape" && onFechar()}
    >
      {estado.situacao === "carregando" ? (
        <>
          <TopoDoLedgr status="abrindo…" onFechar={onFechar} />
          <div className="asst-painel-corpo">
            <p aria-busy="true">Lendo a última conciliação…</p>
          </div>
        </>
      ) : (
        <Conversa
          contexto={estado.situacao === "pronto" ? estado.contexto : null}
          semDados={estado.situacao === "falhou" ? "falhou" : "vazio"}
          onFechar={onFechar}
        />
      )}
    </section>
  );
}

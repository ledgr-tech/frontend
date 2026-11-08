"use client";

import { useEffect, useState } from "react";
import { useRoteador } from "@/lib/roteador";
import { carregarVisaoGeral, type Resultado } from "../conciliacoes/acoes";
import { Conversa, TopoDoLedgr } from "./conversa";
import { montarContexto, type Contexto } from "./respostas";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "falhou" }
  | { situacao: "vazio" }
  | { situacao: "pronto"; contexto: Contexto };

async function lerContexto(): Promise<Resultado<Contexto | null>> {
  const resposta = await carregarVisaoGeral();
  return resposta.ok ? { ok: true, dados: montarContexto(resposta.dados) } : resposta;
}

/**
 * "Fale com o Ledgr" como no design: um painel que abre ao lado do cartão do
 * menu, não uma tela. Vive no menu, que é do layout, então continua aberto
 * quando um link da conversa leva a outra tela. Lê o mesmo que a visão geral (a
 * última conciliação) ao abrir pela primeira vez e antes de responder sobre o mês.
 */
export function PainelAssistente({ id, aberto = true, onFechar }: { id: string; aberto?: boolean; onFechar: () => void }) {
  const router = useRoteador();
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });

  useEffect(() => {
    let vivo = true;
    lerContexto()
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
        const contexto = resposta.dados;
        setEstado(contexto ? { situacao: "pronto", contexto } : { situacao: "vazio" });
      })
      // a Server Action lançou (rede, deploy novo no meio) em vez de devolver um Resultado
      .catch(() => vivo && setEstado({ situacao: "falhou" }));
    return () => {
      vivo = false;
    };
  }, [router]);

  async function atualizarContexto() {
    const resposta = await lerContexto();
    if (resposta.ok) {
      const contexto = resposta.dados;
      setEstado(contexto ? { situacao: "pronto", contexto } : { situacao: "vazio" });
    }
    return resposta;
  }

  return (
    // não modal: dá para ler a conversa e mexer na tela ao lado ao mesmo tempo
    <section
      id={id}
      className="asst-painel"
      role="dialog"
      aria-label="Fale com o Ledgr"
      aria-hidden={!aberto || undefined}
      inert={!aberto}
      tabIndex={-1}
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        evento.preventDefault();
        evento.stopPropagation();
        onFechar();
      }}
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
          aberta={aberto}
          atualizarContexto={atualizarContexto}
          onFechar={onFechar}
        />
      )}
    </section>
  );
}

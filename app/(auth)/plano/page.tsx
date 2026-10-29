import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { contaDaSessao } from "../acoes";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { fonteDestaque } from "../../(marketing)/fonte-destaque";
import { EscolherPlano } from "./escolher-plano";

export const metadata: Metadata = { title: "Escolha o plano · Ledgr" };

/** A escolha do plano que começa o teste de 14 dias. Só para quem está logado e ainda não escolheu. */
export default async function PlanoPage() {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");
  const { assinatura } = await contaDaSessao();
  // sem plano escolhe o do teste; com o teste acabado, volta para assinar
  if (assinatura && assinatura.situacao !== "sem_plano" && assinatura.situacao !== "teste_encerrado") {
    redirect("/visao-geral");
  }
  return (
    <MolduraAuth rotulo="Plano" larguraConteudo={1080}>
      {/* o itálico do título em duas vozes é da landing: carregado só aqui, como lá */}
      <div className={fonteDestaque.variable} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <EscolherPlano encerrado={assinatura?.situacao === "teste_encerrado"} />
      </div>
    </MolduraAuth>
  );
}

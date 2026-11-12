import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { contaDaSessao } from "../acoes";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { fonteDestaque } from "../../(marketing)/fonte-destaque";
import { EscolherPlano } from "./escolher-plano";

export const metadata: Metadata = { title: "Escolha o plano · Ledgr" };

/**
 * A escolha do plano que começa o teste de 14 dias. Só para quem está logado e ainda não escolheu
 * (`sem_plano`, do backend antes do #180); as outras situações assinam na tela Assinatura.
 *
 * ponytail: some junto com o POST /empresa/plano, obsoleto desde o backend #180
 */
export default async function PlanoPage() {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");
  const { assinatura, cobrancaHabilitada } = await contaDaSessao();
  // com a cobrança desligada não há plano a escolher: a Visão geral (pela URL antiga, que acha a empresa)
  if (!cobrancaHabilitada) redirect("/visao-geral");
  if (assinatura && assinatura.situacao !== "sem_plano") redirect("/assinatura");
  return (
    <MolduraAuth rotulo="Plano" larguraConteudo={1080}>
      {/* o itálico do título em duas vozes é da landing: carregado só aqui, como lá */}
      <div className={fonteDestaque.variable} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <EscolherPlano />
      </div>
    </MolduraAuth>
  );
}

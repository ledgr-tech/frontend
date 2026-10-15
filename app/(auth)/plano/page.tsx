import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { contaDaSessao } from "../acoes";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { EscolherPlano } from "./escolher-plano";

/** A escolha do plano que começa o teste de 14 dias. Só para quem está logado e ainda não escolheu. */
export default async function PlanoPage() {
  const sessao = await auth();
  if (!sessao?.user?.email) redirect("/login");
  const { assinatura } = await contaDaSessao();
  if (assinatura && assinatura.situacao !== "sem_plano") redirect("/visao-geral");
  return (
    <MolduraAuth rotulo="Plano" larguraConteudo={1080}>
      <EscolherPlano />
    </MolduraAuth>
  );
}

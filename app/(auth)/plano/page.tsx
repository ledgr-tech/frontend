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
  // sem plano escolhe o do teste; com o teste acabado, volta para assinar
  if (assinatura && assinatura.situacao !== "sem_plano" && assinatura.situacao !== "teste_encerrado") {
    redirect("/visao-geral");
  }
  return (
    <MolduraAuth rotulo="Plano" larguraConteudo={1080}>
      <EscolherPlano encerrado={assinatura?.situacao === "teste_encerrado"} />
    </MolduraAuth>
  );
}

import { redirecionarNoApp } from "@/lib/rotas-servidor";
import { contaDaSessao } from "../../../../(auth)/acoes";
import { carregarPrecos } from "./acoes";
import { PainelDaAssinatura } from "./painel";

/**
 * Os preços vêm da Stripe pelo backend (#180); sem eles, o painel mostra os de referência e o Assinar desligado.
 * Com a cobrança desligada (`cobranca_habilitada` do `GET /me`) a tela não existe: vai para a Visão geral
 * antes de pedir os preços, que respondem 503.
 */
export default async function AssinaturaPage() {
  // ponytail: um GET /me a mais nesta tela (o layout já leu); some se o layout passar a conta por cache()
  // se o /me falhou, não dá para saber: a tela segue (a volta da Stripe não pode cair na Visão geral)
  const conta = await contaDaSessao();
  if (!conta.cobrancaHabilitada && !conta.indisponivel) return redirecionarNoApp("/visao-geral");
  return <PainelDaAssinatura precos={await carregarPrecos()} />;
}

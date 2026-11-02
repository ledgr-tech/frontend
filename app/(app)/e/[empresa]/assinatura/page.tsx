import { carregarPrecos } from "./acoes";
import { PainelDaAssinatura } from "./painel";

/** Os preços vêm da Stripe pelo backend (#180); sem eles, o painel mostra os de referência e o Assinar desligado. */
export default async function AssinaturaPage() {
  return <PainelDaAssinatura precos={await carregarPrecos()} />;
}

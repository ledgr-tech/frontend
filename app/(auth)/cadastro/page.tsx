import type { Metadata } from "next";
import { cobrancaNoSite } from "@/lib/assinatura";
import { FormularioCadastro } from "./formulario";

export const metadata: Metadata = {
  title: "Criar conta · Ledgr",
  // o teste grátis só existe com a cobrança ligada (NEXT_PUBLIC_LEDGR_COBRANCA)
  description: `Crie a conta do Ledgr e concilie o extrato do banco com o do seu sistema de gestão${cobrancaNoSite() ? ": 14 dias grátis, sem cartão" : ""}.`,
};

export default function CadastroPage() {
  return <FormularioCadastro />;
}

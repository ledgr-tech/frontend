import type { Metadata } from "next";
import { FormularioCadastro } from "./formulario";

export const metadata: Metadata = {
  title: "Criar conta · Ledgr",
  description: "Crie a conta do Ledgr e concilie o extrato do banco com o do seu sistema de gestão: 14 dias grátis, sem cartão.",
};

export default function CadastroPage() {
  return <FormularioCadastro />;
}

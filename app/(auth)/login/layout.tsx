import type { Metadata } from "next";

// a página é de cliente e não exporta metadata; o título da aba fica aqui
export const metadata: Metadata = { title: "Entrar · Ledgr", description: "Entre no Ledgr para conciliar o extrato do banco com o do seu sistema de gestão." };

export default function LoginLayout({ children }: LayoutProps<"/login">) {
  return children;
}

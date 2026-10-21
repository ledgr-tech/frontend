import type { Metadata } from "next";

// a página é de cliente e não exporta metadata; o título da aba fica aqui
export const metadata: Metadata = { title: "Redefinir a senha · Ledgr" };

export default function RedefinirSenhaLayout({ children }: LayoutProps<"/redefinir-senha">) {
  return children;
}

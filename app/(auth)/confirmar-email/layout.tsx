import type { Metadata } from "next";

// a página é de cliente e não exporta metadata; o título da aba fica aqui
export const metadata: Metadata = { title: "Confirmar o e-mail · Ledgr" };

export default function ConfirmarEmailLayout({ children }: LayoutProps<"/confirmar-email">) {
  return children;
}

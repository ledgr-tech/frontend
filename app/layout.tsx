import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-heading-family",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const lora = Lora({
  variable: "--font-body-family",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Ledgr",
  description:
    "Concilie o extrato do banco com o extrato do seu sistema de gestão em minutos, sem planilha no meio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${cormorantGaramond.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

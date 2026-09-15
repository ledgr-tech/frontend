import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const interHeading = Inter({
  variable: "--font-heading-family",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const interBody = Inter({
  variable: "--font-body-family",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// mistura: serif de destaque pra títulos/valores em foco, Inter pro resto
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display-family",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// monoespaçada pros rótulos pequenos (CAP. I, REGRA DE OURO...) — remete a
// ticker/planilha/extrato
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-family",
  subsets: ["latin"],
  weight: ["500", "600"],
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
      data-scroll-behavior="smooth"
      className={`${interHeading.variable} ${interBody.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

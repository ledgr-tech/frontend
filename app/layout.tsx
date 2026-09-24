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

// mistura: serif de destaque pra títulos/valores em foco, Inter pro resto. O 400
// é dos números grandes e das manchetes do app: quanto maior, mais leve
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display-family",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      // o script abaixo escreve data-tema/data-densidade antes da hidratação, e o
      // HTML do servidor não os tem — sem isto o React trata como incompatibilidade,
      // avisa que "won't be patched up" e descarta os atributos, fazendo o tema
      // salvo sumir no meio da sessão
      suppressHydrationWarning
      className={`${interHeading.variable} ${interBody.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/* Roda antes da primeira pintura: sem isso o app abriria claro e piscaria
            para o escuro depois da hidratação, e o menu recolhido abriria largo e
            encolheria. Só escreve o atributo quando há escolha salva — sem escolha,
            o CSS segue o prefers-color-scheme e o menu abre largo. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement.dataset,t=localStorage.getItem("ledgr_tema");if(t)d.tema=t;var n=localStorage.getItem("ledgr_densidade");if(n)d.densidade=n;var m=localStorage.getItem("ledgr_menu");if(m)d.menu=m}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

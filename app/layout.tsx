import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, JetBrains_Mono, Newsreader } from "next/font/google";
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

// mistura da landing: serif de destaque pra manchetes e valores em foco
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-display-family",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// títulos e números grandes do app. Variável, com o eixo de tamanho óptico: o
// desenho se ajusta ao corpo (mais contraste no título grande, mais firme no
// médio), como a New York da Apple ao lado da SF
const newsreader = Newsreader({
  variable: "--font-titulo-family",
  subsets: ["latin"],
  axes: ["opsz"],
  // ponytail: sem preload. São 130 KB, a maior fonte, e só o app logado (e a janela no fim da
  // landing) usa; pré-carregada, ela disputava a banda com o CSS e o topo da landing no
  // celular. O navegador baixa quando um título a usa, e o título troca de fonte uma vez.
  preload: false,
});

// monoespaçada pros rótulos pequenos (CAP. I, REGRA DE OURO...) — remete a
// ticker/planilha/extrato
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-family",
  subsets: ["latin"],
  weight: ["500", "600"],
});

// o texto da prévia quando alguém manda o link: o mesmo argumento do subtítulo do hero
const DESCRICAO =
  "Concilie o extrato do banco com o do sistema de gestão que você já usa: em minutos o Ledgr confere linha por linha e aponta só o que não bate.";

// A imagem da prévia é `app/opengraph-image.tsx`. O endereço absoluto dela o Next
// monta sozinho na Vercel (domínio de produção ou da prévia), sem metadataBase.
export const metadata: Metadata = {
  title: "Ledgr",
  description: DESCRICAO,
  openGraph: {
    title: "Ledgr · Pare de conciliar extrato à mão.",
    description: DESCRICAO,
    siteName: "Ledgr",
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
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
      className={`${interHeading.variable} ${interBody.variable} ${cormorantGaramond.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full antialiased`}
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

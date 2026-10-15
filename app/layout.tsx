import type { Metadata } from "next";
import localFont from "next/font/local";
import "./fonts/fontes.css";
import "./globals.css";

// As fontes ficam no repositório (app/fonts, com a licença OFL de cada família) em vez de virem do
// next/font/google, que baixava do Google Fonts a cada build: de vez em quando o Google devolve
// uma URL sem extensão, o next/font não entende e o build cai (vercel/next.js#99114). Os arquivos
// são os mesmos que o Google servia ao next/font, byte a byte.
//
// Cada chamada declara a fatia latina da fonte, a pré-carregada, com o mesmo unicode-range que o
// Google dava a ela (o arquivo traz acentos soltos, como o til U+0303, que o Google manda pegar de
// outra fatia). As outras fatias e os fallbacks com as métricas de antes estão em fonts/fontes.css,
// e entram pelo `fallback`. O unicode-range se repete porque o next/font só aceita literais.

// Títulos e texto. Uma família só, com os quatro pesos: com o next/font/google, as duas chamadas de
// antes (600 e 700 nos títulos, 400 e 500 no texto) viravam a mesma família "Inter", e o título do
// login (--font-heading em peso 400) e o <strong> do texto (--font-body em 700) contavam com isso:
// separadas, sairiam em 600 e num 500 engrossado pelo navegador. O globals.css aponta
// --font-heading-family para esta mesma variável.
const inter = localFont({
  src: [
    { path: "./fonts/inter/inter-latin.woff2", weight: "400" },
    { path: "./fonts/inter/inter-latin.woff2", weight: "500" },
    { path: "./fonts/inter/inter-latin.woff2", weight: "600" },
    { path: "./fonts/inter/inter-latin.woff2", weight: "700" },
  ],
  variable: "--font-body-family",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
  fallback: ["Inter Fatias", "Inter Fallback"],
});

// mistura da landing: serif de destaque pra manchetes e valores em foco
const cormorantGaramond = localFont({
  src: [
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin.woff2", weight: "500" },
    { path: "./fonts/cormorant-garamond/cormorant-garamond-latin.woff2", weight: "600" },
  ],
  variable: "--font-display-family",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
  fallback: ["Cormorant Garamond Fatias", "Cormorant Garamond Fallback"],
});

// títulos e números grandes do app. Variável, com o eixo de tamanho óptico: o
// desenho se ajusta ao corpo (mais contraste no título grande, mais firme no
// médio), como a New York da Apple ao lado da SF. O arquivo traz o eixo opsz
// (6 a 72), e o navegador o ajusta sozinho ao tamanho do texto
const newsreader = localFont({
  src: "./fonts/newsreader/newsreader-latin.woff2",
  weight: "200 800",
  variable: "--font-titulo-family",
  // ponytail: sem preload. São 130 KB, a maior fonte, e só o app logado (e a janela no fim da
  // landing) usa; pré-carregada, ela disputava a banda com o CSS e o topo da landing no
  // celular. O navegador baixa quando um título a usa, e o título troca de fonte uma vez.
  preload: false,
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
  fallback: ["Newsreader Fatias", "Newsreader Fallback"],
});

// monoespaçada pros rótulos pequenos (CAP. I, REGRA DE OURO...) — remete a
// ticker/planilha/extrato
const jetbrainsMono = localFont({
  src: [
    { path: "./fonts/jetbrains-mono/jetbrains-mono-latin.woff2", weight: "500" },
    { path: "./fonts/jetbrains-mono/jetbrains-mono-latin.woff2", weight: "600" },
  ],
  variable: "--font-mono-family",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  adjustFontFallback: false,
  fallback: ["JetBrains Mono Fatias", "JetBrains Mono Fallback"],
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
      className={`${inter.variable} ${cormorantGaramond.variable} ${newsreader.variable} ${jetbrainsMono.variable} h-full antialiased`}
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

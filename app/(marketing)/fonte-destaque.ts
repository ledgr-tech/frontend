import localFont from "next/font/local";
import "../fonts/fontes-destaque.css";

// O itálico do trecho em destaque dos títulos da landing (`.titulo-misto em` no globals.css).
// Fica aqui, e não no layout raiz, para só a landing baixar e pré-carregar o arquivo: o login e o
// app não usam. Local, como as do layout raiz (ver app/layout.tsx): a fatia latina aqui, as outras
// em fonts/fontes-destaque.css, e o fallback de métricas fixas em fonts/fontes.css.
export const fonteDestaque = localFont({
  src: "../fonts/cormorant-garamond/cormorant-garamond-italic-latin.woff2",
  weight: "500",
  style: "italic",
  variable: "--font-destaque-family",
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

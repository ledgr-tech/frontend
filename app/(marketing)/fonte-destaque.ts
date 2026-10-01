import { Cormorant_Garamond } from "next/font/google";

// O itálico do trecho em destaque dos títulos da landing (`.titulo-misto em` no globals.css).
// Fica aqui, e não no layout raiz, para só a landing baixar e pré-carregar o arquivo: o login e o
// app não usam.
export const fonteDestaque = Cormorant_Garamond({
  variable: "--font-destaque-family",
  subsets: ["latin"],
  weight: "500",
  style: "italic",
});

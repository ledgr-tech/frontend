import fs from "node:fs";
import { oklchToHex, inGamut, contraste } from "./oklch.mjs";

const L_CLARO = [0.9695, 0.9298, 0.8694, 0.7808, 0.6807, 0.5792, 0.4795, 0.3795, 0.2897];
const C_ARCO = [0.0237, 0.0563, 0.095, 0.1076, 0.1126, 0.1078, 0.0946, 0.0746, 0.0484];
const PASSOS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const L_ESCURO = [...L_CLARO].reverse();
const FATOR_CROMA = 0.85;

const BG = oklchToHex(0.22, 0.006, 70);
const SURFACE = oklchToHex(0.265, 0.006, 70);
const TEXT = oklchToHex(0.93, 0.004, 85);

function base(H) {
  for (let L = 0.55; L <= 0.95; L += 0.005) {
    let c = 0.1126 * FATOR_CROMA;
    while (c > 0 && !inGamut(L, c, H)) c -= 0.002;
    const hex = oklchToHex(L, c, H);
    if (contraste(hex, BG) >= 4.5) return hex;
  }
  throw new Error("sem base para H=" + H);
}

function rampa(nome, H, cromaFixo) {
  return PASSOS.map((p, i) => {
    let c = cromaFixo ?? C_ARCO[i] * FATOR_CROMA;
    while (c > 0 && !inGamut(L_ESCURO[i], c, H)) c -= 0.002;
    return `  --color-${nome}-${p}: ${oklchToHex(L_ESCURO[i], c, H)};`;
  }).join("\n");
}

const corpo = `  --color-bg: ${BG};
  --color-surface: ${SURFACE};
  --color-text: ${TEXT};
  --color-divider: color-mix(in srgb, ${TEXT} 18%, transparent);

  --color-accent: ${base(73.6)};
  --color-ok: ${base(148)};
  --color-risco: ${base(37.9)};

${rampa("neutral", 70, 0.006)}

${rampa("accent", 73.6)}

${rampa("ok", 148)}

${rampa("risco", 37.9)}`;

const cabecalho = `
/* ── Tema escuro ──────────────────────────────────────────────────────────────
   GERADO — nao editar a mao. Fonte: scripts/gerar-escuro.mjs, que le a escala
   do tema claro e espelha.

   A escala de luminosidade e a MESMA do tema claro, invertida: o passo 100 passa
   a ser o mais escuro e o 900 o mais claro. Isso e o que permite nenhum
   componente mudar de passo — quem pedia --color-ok-700 para texto continua
   pedindo, e recebe um verde claro legivel sobre o fundo escuro em vez de um
   verde escuro. O croma cai 15%, porque cor saturada sobre fundo escuro vibra.

   Escopo: so o app autenticado (.app-shell). A landing e as telas de acesso
   seguem claras porque o logo-barras e 63% de pixels escuros e sumiria no fundo
   escuro — trocar isso exige uma variante clara do logo, que nao existe ainda.

   O bloco aparece duas vezes de proposito: uma para quem pediu escuro no
   sistema operacional e nao forcou claro, outra para quem escolheu escuro no
   proprio app. Os dois sao gerados juntos, entao nao divergem. */
@media (prefers-color-scheme: dark) {
  html:not([data-tema="claro"]) .app-shell {
${corpo.split("\n").map((l) => (l.trim() ? "  " + l : l)).join("\n")}
  }
}

html[data-tema="escuro"] .app-shell {
${corpo}
}
`;

fs.writeFileSync(process.argv[2], cabecalho, "utf8");
console.log("escrito em " + process.argv[2]);
console.log("texto/fundo: " + contraste(TEXT, BG).toFixed(2) + ":1");
for (const [n, H] of [["accent", 73.6], ["ok", 148], ["risco", 37.9]]) {
  console.log(`base ${n}: ${base(H)} -> ${contraste(base(H), BG).toFixed(2)}:1`);
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// O backend monta os e-mails com <FRONTEND_URL>/email/<nome>: estes nomes são contrato com ele
// (app/services/email/mensagens.py e docs/superpowers/specs/2026-11-12-emails-estilo-v5.md).
const PASTA = path.join(process.cwd(), "public", "email");
const IMAGENS = ["logo", "envelope", "joinha", "comemorando", "neutro", "dupla"];
const FONTES = ["inter", "cormorant-garamond-italico", "jetbrains-mono"];

describe("arquivos públicos dos e-mails", () => {
  it.each(IMAGENS)("serve /email/%s.png como PNG", (nome) => {
    const arquivo = path.join(PASTA, `${nome}.png`);
    expect(existsSync(arquivo)).toBe(true);
    expect(readFileSync(arquivo).subarray(1, 4).toString()).toBe("PNG");
  });

  it.each(FONTES)("serve /email/fontes/%s.woff2", (nome) => {
    const arquivo = path.join(PASTA, "fontes", `${nome}.woff2`);
    expect(existsSync(arquivo)).toBe(true);
    expect(readFileSync(arquivo).subarray(0, 4).toString()).toBe("wOF2");
  });
});

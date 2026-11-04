import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DadosDaDemonstracao } from "./demonstracao";
import { PAGINAS } from "./paginas";

// as cenas são capturas do app (gravar.mjs --html): se uma captura nova perder o alvo de um passo, o destaque
// e o cursor somem sem erro nenhum
describe("demonstrações da Central", () => {
  const paginas = PAGINAS.filter((p) => p.demonstracao);

  it("existe ao menos uma", () => expect(paginas.length).toBeGreaterThan(0));

  it.each(paginas.map((p) => [p.id, p.demonstracao!]))("%s: cada passo acha o seu alvo na cena dele", (_, arquivo) => {
    const caminho = join("public", arquivo);
    expect(existsSync(caminho), caminho).toBe(true);
    const dados: DadosDaDemonstracao = JSON.parse(readFileSync(caminho, "utf8"));
    expect(dados.passos.length).toBeGreaterThan(0);
    for (const passo of dados.passos) {
      expect(dados.cenas[passo.cena], `passo de ${passo.t} ms`).toBeDefined();
      for (const marca of [passo.foco, passo.cursor]) {
        if (marca != null) expect(dados.cenas[passo.cena], `passo de ${passo.t} ms`).toContain(`data-passo="${marca}"`);
      }
    }
    // HTML estático: nada que rode nem endereço de uma tela do app
    for (const html of [dados.barra, ...dados.cenas]) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/href="\/e\//);
    }
  });
});

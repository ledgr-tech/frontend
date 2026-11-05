import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DadosDaDemonstracao, DadosDasFiguras } from "./demonstracao";
import { PAGINAS } from "./paginas";

// os itens do menu da vitrine (app/(marketing)/vitrine.tsx), onde o player acha um alvo do menu lateral
const ITENS_DO_MENU = ["Nova conciliação", "Visão geral", "Extratos", "Conciliações", "Fechamentos", "Histórico", "Empresas", "Assinatura"];

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
      // o alvo fica na cena, numa janela por cima dela ou, por nome, no menu lateral da vitrine
      const tela = dados.cenas[passo.cena] + (dados.camadas?.[passo.cena] ?? "");
      for (const marca of [passo.foco, passo.cursor]) {
        if (typeof marca === "string") expect(ITENS_DO_MENU.some((item) => marca.startsWith(`menu:${item}`)), marca).toBe(true);
        else if (marca != null) expect(tela, `passo de ${passo.t} ms`).toContain(`data-passo="${marca}"`);
      }
    }
    // HTML estático: nada que rode nem endereço de uma tela do app
    for (const html of [dados.barra, ...dados.cenas, ...(dados.camadas ?? [])]) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/href="\/e\//);
    }
  });
});

// as figuras das seções são capturas do app (gravar.mjs --figuras): se uma captura nova perder o que a figura
// recorta, ela some sem erro nenhum; e o tamanho da página reserva o espaço, então tem de ser o da captura
describe("figuras da Central", () => {
  const paginas = PAGINAS.filter((p) => p.funcoes.some((f) => f.figura));

  it("existe ao menos uma", () => expect(paginas.length).toBeGreaterThan(0));

  it.each(paginas.map((p) => [p.id]))("%s: cada figura acha o que recorta, no tamanho da página", (id) => {
    const caminho = join("public", "ajuda", `${id}--figuras.json`);
    expect(existsSync(caminho), caminho).toBe(true);
    const dados: DadosDasFiguras = JSON.parse(readFileSync(caminho, "utf8"));
    for (const funcao of PAGINAS.find((p) => p.id === id)!.funcoes.filter((f) => f.figura)) {
      const figura = dados.figuras[funcao.id];
      expect(figura, funcao.id).toBeDefined();
      expect({ largura: figura.largura, altura: figura.altura }, funcao.id).toEqual(funcao.figura);
      const tela = dados.cenas[figura.cena] + (figura.camada == null ? "" : dados.camadas![figura.camada]);
      expect(tela, funcao.id).toContain(`data-figura="${funcao.id}"`);
    }
    for (const html of [dados.barra, ...dados.cenas, ...(dados.camadas ?? [])]) {
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/href="\/e\//);
    }
  });
});

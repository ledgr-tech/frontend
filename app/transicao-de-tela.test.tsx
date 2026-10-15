import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { render, screen } from "@testing-library/react";
import { TransicaoDeTela } from "./transicao-de-tela";

const css = postcss.parse(readFileSync(join(process.cwd(), "app", "globals.css"), "utf8"));

/** As declarações do seletor exato, fora de @media. */
function declaracoes(seletor: string): Record<string, string> {
  const decl: Record<string, string> = {};
  css.walkRules((regra) => {
    if (regra.selector.replace(/\s+/g, " ") !== seletor || regra.parent?.type === "atrule") return;
    regra.walkDecls((d) => {
      decl[d.prop] = d.value;
    });
  });
  return decl;
}

describe("TransicaoDeTela", () => {
  it("renders the screen content (falling back to a plain wrapper where React has no ViewTransition)", () => {
    render(
      <TransicaoDeTela>
        <main>
          <h1>Crie seu acesso.</h1>
        </main>
      </TransicaoDeTela>,
    );
    expect(screen.getByRole("heading", { name: "Crie seu acesso." })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  // o navegador desenha as telas que trocam numa camada acima da página, onde o z-index não vale:
  // sem nome próprio, o menu (com o painel do assistente) e a barra do topo iam no retrato da raiz,
  // e a tela que saía e o esqueleto da que entrava passavam por cima deles (o jsdom não pinta nada;
  // a prova é clicar num link do assistente com o menu aberto por cima)
  it("keeps the side menu and the top bar above the screens while they swap", () => {
    expect(declaracoes(".app-aside")["view-transition-name"]).toBe("menu-lateral");
    expect(declaracoes(".app-topo")["view-transition-name"]).toBe("barra-superior");
    const menu = Number(declaracoes("::view-transition-group(menu-lateral)")["z-index"]);
    const barra = Number(declaracoes("::view-transition-group(barra-superior)")["z-index"]);
    expect(barra).toBeGreaterThan(0);
    // como na página: o menu (z 50) passa por cima da barra (z 45), com as dicas e o assistente
    expect(menu).toBeGreaterThan(barra);
  });
});

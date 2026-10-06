import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss, { type AtRule } from "postcss";

/**
 * Quebras de layout que o jsdom não vê (ele não mede nada) e que a varredura no navegador achou
 * em 06/10. Cada teste confere a regra do globals.css que segura uma delas; a prova de verdade
 * é abrir a tela na largura citada.
 */

const css = postcss.parse(readFileSync(join(process.cwd(), "app", "globals.css"), "utf8"));

/** As declarações do seletor exato, fora de @media ou dentro do @media com estes parâmetros. */
function declaracoes(seletor: string, media?: string): Record<string, string> {
  const decl: Record<string, string> = {};
  css.walkRules((regra) => {
    if (regra.selector.replace(/\s+/g, " ") !== seletor) return;
    const pai = regra.parent?.type === "atrule" ? (regra.parent as AtRule) : null;
    if ((pai?.params ?? undefined) !== media) return;
    regra.walkDecls((d) => {
      decl[d.prop] = d.value;
    });
  });
  return decl;
}

describe("layout responsivo", () => {
  // Visão geral a 375px rolava 283px para o lado, e a conciliação a 1024px, 120px: o texto do
  // leitor de tela (.sr-only, absoluto) da última coluna tinha como bloco de contenção um pai
  // de fora da caixa de rolagem, e o overflow dela não o cortava
  it("a caixa de rolagem das tabelas contém o que é posicionado dentro dela", () => {
    expect(declaracoes(".dash-tabela-rolagem")).toMatchObject({ "overflow-x": "auto", position: "relative" });
  });

  // até 900px a grade do app é uma coluna com min-height de 100vh; com linhas automáticas, a
  // altura que sobra numa tela curta ia meio a meio, e o menu ganhava um vão de até 180px embaixo
  it("no celular, a altura que sobra vai para o conteúdo, não para o menu", () => {
    expect(declaracoes(".app-shell", "(max-width: 900px)")["grid-template-rows"]).toBe("auto 1fr");
  });

  // entre ~800 e 1000px o "-R$ 12.640,00" quebrava depois do hífen e vazava do cartão
  it("o valor do detalhe da divergência fica numa linha e mede o cartão, não a janela", () => {
    expect(declaracoes(".det-cartao")["container-type"]).toBe("inline-size");
    const valor = declaracoes(".det-valor");
    expect(valor["white-space"]).toBe("nowrap");
    expect(valor["font-size"]).toMatch(/cqi/);
  });

  // a 768–1024px o "99,2%" de "Casaram sozinhos" passava da borda do conteúdo: o número do
  // resumo não quebra, então a taxa precisa poder descer para a linha de baixo
  it("a taxa do resumo do histórico desce de linha quando não cabe ao lado do número", () => {
    expect(declaracoes(".hist-resumo dd")).toMatchObject({ display: "flex", "flex-wrap": "wrap" });
  });
});

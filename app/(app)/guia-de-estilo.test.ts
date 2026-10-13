import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import postcss from "postcss";

/**
 * O guia de estilo (docs/Ledgr-guia-de-estilo.pdf, cap. II) nas telas do app. O teste de tela
 * não carrega o globals.css, então um `style={{}}` que troca a fonte ou uma regra nova com outro
 * espaçamento passa sem ninguém ver; este lê o código e o CSS e confere as regras que já furaram.
 */

const RAIZ = process.cwd();
const PASTA_APP = join(RAIZ, "app", "(app)");

type Elemento = {
  onde: string;
  tag: string;
  classes: string[];
  estilo: Map<string, ts.Expression>;
};

function arquivosDoApp(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return arquivosDoApp(caminho);
    return e.name.endsWith(".tsx") && !e.name.includes(".test.") ? [caminho] : [];
  });
}

function textoDaClasse(valor: ts.JsxAttributeValue | undefined): string {
  if (!valor) return "";
  if (ts.isStringLiteral(valor)) return valor.text;
  if (!ts.isJsxExpression(valor) || !valor.expression) return "";
  const expr = valor.expression;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isTemplateExpression(expr)) return [expr.head.text, ...expr.templateSpans.map((s) => s.literal.text)].join(" ");
  return "";
}

const elementos: Elemento[] = [];
const tracosSoltos: string[] = [];
const palavrasDoApp = new Set<string>();

for (const arquivo of arquivosDoApp(PASTA_APP)) {
  const fonte = ts.createSourceFile(arquivo, readFileSync(arquivo, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const onde = (no: ts.Node) =>
    `${relative(RAIZ, arquivo).replaceAll("\\", "/")}:${fonte.getLineAndCharacterOfPosition(no.getStart()).line + 1}`;

  const visitar = (no: ts.Node) => {
    // toda palavra em string pode ser classe (inclusive as montadas fora do className)
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      for (const p of no.text.split(/\s+/)) if (p) palavrasDoApp.add(p);
    }
    if (ts.isJsxOpeningElement(no) || ts.isJsxSelfClosingElement(no)) {
      const atributos = no.attributes.properties.filter(ts.isJsxAttribute);
      const atributo = (nome: string) => atributos.find((a) => a.name.getText() === nome);
      const estilo = new Map<string, ts.Expression>();
      const style = atributo("style")?.initializer;
      if (style && ts.isJsxExpression(style) && style.expression && ts.isObjectLiteralExpression(style.expression)) {
        for (const p of style.expression.properties) {
          if (ts.isPropertyAssignment(p)) estilo.set(p.name.getText(), p.initializer);
        }
      }
      elementos.push({
        onde: onde(no),
        tag: no.tagName.getText(),
        classes: textoDaClasse(atributo("className")?.initializer).split(/\s+/).filter(Boolean),
        estilo,
      });
      const traco = atributo("strokeWidth")?.initializer;
      if (traco && ts.isJsxExpression(traco) && traco.expression && ts.isNumericLiteral(traco.expression)) {
        tracosSoltos.push(onde(no));
      }
    }
    // o traço também pode vir num objeto de props espalhado no ícone ({ size, strokeWidth })
    if (ts.isPropertyAssignment(no) && no.name.getText() === "strokeWidth" && ts.isNumericLiteral(no.initializer)) {
      tracosSoltos.push(onde(no));
    }
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
}

type Regra = { onde: string; seletor: string; classes: string[]; decl: Record<string, string> };

const regras: Regra[] = [];
postcss.parse(readFileSync(join(RAIZ, "app", "globals.css"), "utf8")).walkRules((r) => {
  const decl: Record<string, string> = {};
  r.walkDecls((d) => {
    decl[d.prop] = d.value;
  });
  regras.push({
    onde: `globals.css:${r.source?.start?.line}`,
    seletor: r.selector.replace(/\s+/g, " "),
    classes: (r.selector.match(/\.[\w-]+/g) ?? []).map((c) => c.slice(1)),
    decl,
  });
});

// o que só delimita onde a regra vale, não o que ela pinta
const ESCOPOS = new Set(["app-shell", "vitrine-app", "demonstracao-folhas", "legal"]);
const regrasDoApp = regras.filter((r) => r.classes.some((c) => !ESCOPOS.has(c) && palavrasDoApp.has(c)));
const maiorPx = (valor = "") => Math.max(0, ...[...valor.matchAll(/([\d.]+)px/g)].map((m) => Number(m[1])));
const naInter = (familia = "") => /--font-(heading|body)\b/.test(familia);

describe("guia de estilo nas telas do app", () => {
  it("nenhum style inline escolhe a fonte: a família vem do CSS", () => {
    const comFonte = elementos.filter((e) => e.estilo.has("fontFamily")).map((e) => `${e.onde} <${e.tag}>`);
    expect(comFonte).toEqual([]);
  });

  it("texto de 20px ou mais com tamanho inline é título: h1–h3 ou .font-titulo, na Newsreader", () => {
    const naInterGrande = elementos
      .filter((e) => {
        const tamanho = e.estilo.get("fontSize");
        return tamanho && ts.isNumericLiteral(tamanho) && Number(tamanho.text) >= 20;
      })
      .filter((e) => !/^h[1-3]$/.test(e.tag) && !e.classes.includes("font-titulo"))
      .map((e) => `${e.onde} <${e.tag}>`);
    expect(naInterGrande).toEqual([]);
  });

  it("regra do CSS que põe a Inter em 20px ou mais tem a classe na lista da Newsreader", () => {
    const naNewsreader = new Set(
      regras.filter((r) => r.decl["font-family"]?.includes("--font-titulo")).flatMap((r) => r.classes),
    );
    const EXCECOES: Record<string, string> = {
      // o nome Ledgr no menu é a marca: Inter 600, como no logo (guia, cap. I)
      ".app-aside-marca": "marca",
      // o + que abre e fecha a seção é um glifo, não texto
      ".recolhivel-titulo::after": "glifo",
    };
    const tituloNaInter = regrasDoApp
      .filter((r) => naInter(r.decl["font-family"]) && maiorPx(r.decl["font-size"]) >= 20)
      .filter((r) => !r.classes.some((c) => !ESCOPOS.has(c) && naNewsreader.has(c)))
      .filter((r) => !(r.seletor in EXCECOES))
      .map((r) => `${r.onde} ${r.seletor}`);
    expect(tituloNaInter).toEqual([]);
  });

  it("rótulo em caixa alta segue uma régua só: +0,08em, em 11px (tabela), 12px ou 14px (h6)", () => {
    const foraDaRegua = regrasDoApp
      .filter((r) => r.decl["text-transform"] === "uppercase")
      .filter((r) => r.decl["letter-spacing"] !== "0.08em" || !["11px", "12px", "14px"].includes(r.decl["font-size"] ?? "12px"))
      .map((r) => `${r.onde} ${r.seletor} (${r.decl["font-size"]}, ${r.decl["letter-spacing"]})`);
    const inline = elementos.filter((e) => e.estilo.has("textTransform")).map((e) => `${e.onde} <${e.tag}>`);
    expect([...foraDaRegua, ...inline]).toEqual([]);
  });

  it("ícone não escolhe o próprio traço: o do guia (1,75) vem do TRACO_ICONE", () => {
    expect(tracosSoltos).toEqual([]);
  });
});

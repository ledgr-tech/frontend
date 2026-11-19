// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * O Next 16 depreciou a prop `priority` do `next/image` em favor de `preload` (para a imagem
 * principal da página) ou `loading="eager"` (para o que entra já visível sem ir ao `<head>`).
 */
const PASTAS = ["app", "lib"].map((pasta) => path.join(process.cwd(), pasta));

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.tsx$/.test(entrada.name) && !/\.test\.tsx$/.test(entrada.name) ? [caminho] : [];
  });
}

function usaPriority(fonte: string): boolean {
  const arvore = ts.createSourceFile("arquivo.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let nome: string | undefined;
  for (const no of arvore.statements) {
    if (ts.isImportDeclaration(no) && ts.isStringLiteral(no.moduleSpecifier) && no.moduleSpecifier.text === "next/image") {
      nome = no.importClause?.name?.text;
      if (nome) break;
    }
  }
  if (!nome) return false;

  function visitar(no: ts.Node): boolean {
    if (
      (ts.isJsxSelfClosingElement(no) || ts.isJsxOpeningElement(no)) &&
      no.tagName.getText() === nome &&
      no.attributes.properties.some((atributo) => ts.isJsxAttribute(atributo) && atributo.name.getText() === "priority")
    ) {
      return true;
    }
    return ts.forEachChild(no, visitar) ?? false;
  }
  return visitar(arvore);
}

describe("next/image sem a prop depreciada priority", () => {
  it("nenhum componente usa priority em <Image>", () => {
    const ofensores: string[] = [];
    for (const pasta of PASTAS) {
      for (const arquivo of arquivos(pasta)) {
        const fonte = fs.readFileSync(arquivo, "utf8");
        if (usaPriority(fonte)) {
          ofensores.push(path.relative(process.cwd(), arquivo).split(path.sep).join("/"));
        }
      }
    }
    expect(ofensores, `\n${ofensores.join("\n")}\n`).toEqual([]);
  });

  it("reconhece a prop priority no import padrão de next/image, inclusive com alias e funções, sem confundir outros usos", () => {
    const IMG = 'import Image from "next/image";\n';
    expect(usaPriority(IMG + '<Image src="/x.png" alt="" width={10} height={10} priority />')).toBe(true);
    expect(usaPriority(IMG + '<Image\n  src="/x.png"\n  alt=""\n  priority={true}\n/>')).toBe(true);
    expect(usaPriority(IMG + '<Image src="/x.png" alt="" onLoad={() => pronto(true)} priority />')).toBe(true);
    expect(usaPriority('import Foto from "next/image";\n<Foto src="/x.png" alt="" priority />')).toBe(true);
    expect(usaPriority(IMG + '<Image src="/x.png" alt="" preload />')).toBe(false);
    expect(usaPriority(IMG + '<Image src="/x.png" alt="" loading="eager" />')).toBe(false);
    expect(usaPriority(IMG + '<Image src="/x.png" alt="priority" />')).toBe(false);
    expect(usaPriority(IMG + '<Image src="/x.png" alt="" className={estilo.priority} />')).toBe(false);
    expect(usaPriority('<Outra priority />')).toBe(false);
  });
});

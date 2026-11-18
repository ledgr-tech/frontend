// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

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

const IMAGE_COM_PRIORITY = /<Image\b(?:[^>"']|"[^"]*"|'[^']*')*\bpriority\b/;

describe("next/image sem a prop depreciada priority", () => {
  it("nenhum componente usa priority em <Image>", () => {
    const ofensores: string[] = [];
    for (const pasta of PASTAS) {
      for (const arquivo of arquivos(pasta)) {
        const fonte = fs.readFileSync(arquivo, "utf8");
        if (IMAGE_COM_PRIORITY.test(fonte)) {
          ofensores.push(path.relative(process.cwd(), arquivo).split(path.sep).join("/"));
        }
      }
    }
    expect(ofensores, `\n${ofensores.join("\n")}\n`).toEqual([]);
  });

  it("a regra reconhece priority em uma ou várias linhas e ignora preload e loading", () => {
    expect(IMAGE_COM_PRIORITY.test('<Image src="/x.png" alt="" width={10} height={10} priority />')).toBe(true);
    expect(IMAGE_COM_PRIORITY.test('<Image\n  src="/x.png"\n  alt=""\n  priority={true}\n/>')).toBe(true);
    expect(IMAGE_COM_PRIORITY.test('<Image src="/x.png" alt="" width={10} height={10} preload />')).toBe(false);
    expect(IMAGE_COM_PRIORITY.test('<Image src="/x.png" alt="" width={10} height={10} loading="eager" />')).toBe(false);
    expect(IMAGE_COM_PRIORITY.test('<Image src="/x.png" alt="priority" width={10} height={10} />')).toBe(false);
  });
});

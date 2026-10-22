// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SECOES } from "./rotas";

/**
 * O guarda da empresa ativa na URL (spec 2026-10-21-empresa-ativa-na-url): toda tela de `app/(app)/e/[empresa]`
 * leva a outra tela pelos auxiliares que prefixam `/e/<empresa>` (`LinkDoApp`, `useRoteador`,
 * `redirecionarNoApp`). Um `Link`, um `useRouter`, um `redirect` ou um endereço cru para uma tela da empresa
 * leva à empresa errada, ou a nenhuma, sem que nenhum outro teste perceba: aqui ele quebra o build.
 */
const RAIZ = path.join(process.cwd(), "app", "(app)", "e", "[empresa]");
const SECAO = `(?:${SECOES.join("|")})`;
// aspas de abrir de um endereço literal: ", ' ou `
const ASPA = String.raw`["'` + "`" + String.raw`]`;

function arquivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx)$/.test(entrada.name) && !/\.test\.(ts|tsx)$/.test(entrada.name) ? [caminho] : [];
  });
}

const ANCORA_CRUA = new RegExp(String.raw`<a\b[^>]*\bhref=\{?\s*${ASPA}/${SECAO}\b`);
const ABRE_CRU = new RegExp(String.raw`window\.open\(\s*${ASPA}/${SECAO}\b`);
const LOCATION_CRU = new RegExp(String.raw`location\.(?:href\s*=|assign\()\s*${ASPA}/${SECAO}\b`);

// <a href={x}> com expressão que não passa por comEmpresa: o endereço de uma tela da empresa sairia sem o prefixo
const ANCORA_DINAMICA = /<a\b[^>]*\bhref=\{\s*(?!comEmpresa\()/;

const REGRAS: { nome: string; acha: (fonte: string) => boolean }[] = [
  { nome: 'importa Link de "next/link" (use @/lib/link-do-app)', acha: (f) => /from\s*["']next\/link["']/.test(f) },
  {
    nome: 'importa useRouter ou redirect de "next/navigation" (use @/lib/roteador e @/lib/rotas-servidor)',
    acha: (f) =>
      [...f.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']next\/navigation["']/g)].some((importacao) =>
        /\b(?:useRouter|redirect)\b/.test(importacao[1]),
      ),
  },
  { nome: "tem <a href> para uma tela da empresa (use o LinkDoApp)", acha: (f) => ANCORA_CRUA.test(f) },
  { nome: "tem <a href={...}> que não passa por comEmpresa(empresa.id, ...)", acha: (f) => ANCORA_DINAMICA.test(f) },
  {
    nome: "abre uma tela da empresa por window.open ou location com endereço cru",
    acha: (f) => ABRE_CRU.test(f) || LOCATION_CRU.test(f),
  },
];

describe("as telas da empresa navegam pelos auxiliares da empresa ativa", () => {
  it("nenhum arquivo de app/(app)/e/[empresa] usa Link, useRouter, redirect ou endereço cru para tela da empresa", () => {
    const ofensores: string[] = [];
    for (const arquivo of arquivos(RAIZ)) {
      const fonte = fs.readFileSync(arquivo, "utf8");
      for (const regra of REGRAS) {
        if (regra.acha(fonte)) ofensores.push(`${path.relative(process.cwd(), arquivo).split(path.sep).join("/")}: ${regra.nome}`);
      }
    }
    expect(ofensores, `\n${ofensores.join("\n")}\n`).toEqual([]);
  });

  it("o guarda enxerga os arquivos da árvore (não passa em vão por uma pasta vazia)", () => {
    expect(arquivos(RAIZ).length).toBeGreaterThan(50);
  });

  it("as regras acham o que procuram (um guarda que nunca acha nada não guarda nada)", () => {
    expect(REGRAS[0].acha('import Link from "next/link";')).toBe(true);
    expect(REGRAS[1].acha('import { usePathname, useRouter } from "next/navigation";')).toBe(true);
    expect(REGRAS[1].acha('import { notFound, redirect } from "next/navigation";')).toBe(true);
    expect(REGRAS[1].acha('import { usePathname, notFound } from "next/navigation";')).toBe(false);
    expect(REGRAS[2].acha('<a href="/fechamentos/x/relatorio" target="_blank">')).toBe(true);
    expect(REGRAS[2].acha("<a\n  href={`/extratos/${id}`}>")).toBe(true);
    expect(REGRAS[2].acha('<a href="https://exemplo.com">')).toBe(false);
    expect(REGRAS[3].acha("<a href={paginaInteira} className=\"btn\">")).toBe(true);
    expect(REGRAS[3].acha("<a\n  href={ paginaInteira }>")).toBe(true);
    expect(REGRAS[3].acha("<a href={comEmpresa(id, p)}>")).toBe(false);
    expect(REGRAS[3].acha('<a href="mailto:x@y.com">')).toBe(false);
    expect(REGRAS[4].acha('window.open("/historico")')).toBe(true);
    expect(REGRAS[4].acha("location.href = `/regras`")).toBe(true);
  });
});

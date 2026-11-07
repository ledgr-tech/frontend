import { existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { TELAS_DO_TUTORIAL } from "@/lib/preferencias";
import { telaDoCaminho, TUTORIAIS } from "./roteiros";

describe("tutoriais", () => {
  it("cada tela tem passos curtos, com até quatro passos fora do painel da comparação", () => {
    for (const tela of TELAS_DO_TUTORIAL) {
      const { passos } = TUTORIAIS[tela];
      expect(passos.length).toBeGreaterThanOrEqual(2);
      const painel = passos.filter((passo) => tela === "comparacao" && passo.alvo === "painel");
      expect(passos.length - painel.length).toBeLessThanOrEqual(4);
      if (tela === "comparacao") expect(painel.map((passo) => passo.titulo)).toEqual(["Lançamento em foco", "Fixado", "Justificar", "Abrir detalhe"]);
      for (const passo of passos) {
        expect(passo.alvo).toMatch(/^[a-z-]+$/);
        expect(passo.texto.length).toBeLessThanOrEqual(220);
        // texto do app sem travessão entre orações
        expect(passo.texto).not.toMatch(/ — /);
      }
    }
  });

  it("o mascote de cada passo é um arquivo que existe", () => {
    for (const tela of TELAS_DO_TUTORIAL) {
      const { mascote, passos } = TUTORIAIS[tela];
      for (const passo of passos) expect(existsSync(`public${passo.mascote ?? mascote}`)).toBe(true);
    }
  });

  it("acha a tela pelo endereço", () => {
    expect(telaDoCaminho("/visao-geral")).toBe("visao-geral");
    expect(telaDoCaminho("/dashboard")).toBe("conciliacoes");
    expect(telaDoCaminho("/conciliacoes/nova")).toBe("nova-conciliacao");
    expect(telaDoCaminho("/conciliacoes/abc")).toBe("comparacao");
    expect(telaDoCaminho("/conciliacoes/abc/linha-1")).toBe("divergencia");
    expect(telaDoCaminho("/extratos")).toBe("extratos");
    expect(telaDoCaminho("/historico")).toBe("historico");
    expect(telaDoCaminho("/fechamentos")).toBe("fechamentos");
    expect(telaDoCaminho("/fechamentos/2026-09/relatorio")).toBeNull();
    expect(telaDoCaminho("/assinatura")).toBeNull();
  });
});

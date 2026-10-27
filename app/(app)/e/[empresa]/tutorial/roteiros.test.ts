import { describe, it, expect } from "vitest";
import { TELAS_DO_TUTORIAL } from "@/lib/preferencias";
import { telaDoCaminho, TUTORIAIS } from "./roteiros";

describe("tutoriais", () => {
  it("cada tela tem de 2 a 4 passos curtos, com alvo", () => {
    for (const tela of TELAS_DO_TUTORIAL) {
      const { passos } = TUTORIAIS[tela];
      expect(passos.length).toBeGreaterThanOrEqual(2);
      expect(passos.length).toBeLessThanOrEqual(4);
      for (const passo of passos) {
        expect(passo.alvo).toMatch(/^[a-z-]+$/);
        expect(passo.texto.length).toBeLessThanOrEqual(220);
        // texto do app sem travessão entre orações
        expect(passo.texto).not.toMatch(/ — /);
      }
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

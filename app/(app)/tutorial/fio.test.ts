import { describe, it, expect } from "vitest";
import { caminhoDoFio, pontaDoFio, pontasDoFio } from "./fio";

const caixa = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

/** Os pontos de controle e de chegada de cada Q, na ordem. */
function trechos(d: string) {
  return [...d.matchAll(/Q(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)/g)].map((m) => m.slice(1).map(Number));
}

describe("caminhoDoFio", () => {
  it("numa reta de 85px tem 10 meias ondas de 8,5px, da origem ao destino", () => {
    const d = caminhoDoFio({ x: 0, y: 0 }, { x: 85, y: 0 });
    expect(d.startsWith("M0 0")).toBe(true);
    expect(trechos(d)).toHaveLength(10);
    expect(d.endsWith("85 0")).toBe(true);
    expect(d).toMatch(/^[MQ\d .-]+$/);
  });

  it("os pontos de controle alternam +3 e -3 na perpendicular", () => {
    const t = trechos(caminhoDoFio({ x: 0, y: 0 }, { x: 85, y: 0 }));
    expect(t.slice(0, 4).map((q) => q[1])).toEqual([3, -3, 3, -3]);
    expect(t[0][0]).toBe(4.25);
  });

  it("uma distância que não é múltipla de 8,5 arredonda as meias ondas e termina em para", () => {
    const d = caminhoDoFio({ x: 10, y: 20 }, { x: 10, y: 20 + 30 });
    expect(trechos(d)).toHaveLength(4); // 30 / 8,5 = 3,5 -> 4
    expect(d.endsWith("10 50")).toBe(true);
    expect(trechos(d)[0][0]).toBe(10 - 3); // perpendicular de uma reta vertical é horizontal
  });

  it("uma distância curtíssima ainda tem uma meia onda", () => {
    expect(trechos(caminhoDoFio({ x: 0, y: 0 }, { x: 1, y: 0 }))).toHaveLength(1);
  });
});

describe("pontaDoFio", () => {
  it("são dois traços de 7px a 28 graus da direção, saindo de para", () => {
    const partes = pontaDoFio({ x: 0, y: 0 }, { x: 100, y: 0 }).match(/M[^M]+/g)!;
    expect(partes).toHaveLength(2);
    const sinais: number[] = [];
    for (const parte of partes) {
      const [, mx, my, lx, ly] = parte.match(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/)!.map(Number);
      expect([mx, my]).toEqual([100, 0]);
      expect(Math.hypot(lx - mx, ly - my)).toBeCloseTo(7, 1);
      const angulo = (Math.atan2(ly - my, lx - mx) * 180) / Math.PI;
      expect(Math.abs(angulo)).toBeCloseTo(180 - 28, 0);
      sinais.push(Math.sign(angulo));
    }
    expect(sinais.sort()).toEqual([-1, 1]);
  });
});

describe("pontasDoFio", () => {
  const alvo = caixa(100, 200, 300, 50);
  it("nas telas largas, sai do meio da borda esquerda do cartão e chega ao meio da borda direita do alvo, recuado 8px", () => {
    expect(pontasDoFio(caixa(900, 100, 340, 400), alvo, true)).toEqual({
      de: { x: 900, y: 300 },
      para: { x: 408, y: 225 },
    });
  });

  it("nas menores, sai do meio da borda de cima e chega ao meio da borda de baixo do alvo", () => {
    expect(pontasDoFio(caixa(0, 500, 400, 300), alvo, false)).toEqual({
      de: { x: 200, y: 500 },
      para: { x: 250, y: 250 },
    });
  });

  it("devolve null para um alvo sem área e para um alvo todo fora da janela", () => {
    const cartao = caixa(900, 100, 340, 400);
    expect(pontasDoFio(cartao, caixa(100, 200, 0, 0), true)).toBeNull();
    expect(pontasDoFio(cartao, caixa(100, 200, 300, 0), true)).toBeNull();
    expect(pontasDoFio(cartao, caixa(100, -500, 300, 50), true)).toBeNull();
    expect(pontasDoFio(cartao, caixa(100, window.innerHeight + 10, 300, 50), true)).toBeNull();
    expect(pontasDoFio(cartao, caixa(-400, 200, 300, 50), true)).toBeNull();
  });
});

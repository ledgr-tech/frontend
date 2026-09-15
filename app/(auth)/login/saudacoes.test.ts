import { describe, it, expect } from "vitest";
import { SAUDACOES, escolherSaudacao } from "./saudacoes";

describe("escolherSaudacao", () => {
  it("returns a valid index when there is no previous greeting", () => {
    const indice = escolherSaudacao(null, () => 0.99);
    expect(indice).toBeGreaterThanOrEqual(0);
    expect(indice).toBeLessThan(SAUDACOES.length);
  });

  it("never repeats the previous greeting", () => {
    for (let anterior = 0; anterior < SAUDACOES.length; anterior++) {
      for (const sorteio of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(escolherSaudacao(anterior, () => sorteio)).not.toBe(anterior);
      }
    }
  });

  it("ignores a stored index that is out of range", () => {
    const indice = escolherSaudacao(99, () => 0);
    expect(indice).toBe(0);
  });
});

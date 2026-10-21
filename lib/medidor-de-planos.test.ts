import { afterEach, describe, it, expect } from "vitest";
import { PASSOS, lembrarPlano, marcaDoPlano, passoDoPlano, planoDoVolume, planoLembrado, rotuloDoVolume, ULTIMO_PASSO, volumeDoPasso } from "./medidor-de-planos";

afterEach(() => sessionStorage.clear());

describe("o medidor de planos", () => {
  it("indica o plano pelo teto de cada um, e acima de 350 o combinado com a equipe", () => {
    expect([1, 100, 101, 200, 201, 350, 351, 6000].map(planoDoVolume)).toEqual([
      "essencial",
      "essencial",
      "padrao",
      "padrao",
      "avancado",
      "avancado",
      "volume",
      "volume",
    ]);
  });

  it("leva o medidor ao teto do plano, e a marca do Volume é a do 5.000+", () => {
    expect(PASSOS[passoDoPlano("padrao")]).toBe(200);
    expect(planoDoVolume(PASSOS[passoDoPlano("avancado")])).toBe("avancado");
    expect(PASSOS[marcaDoPlano("volume")]).toBe(5000);
    expect(rotuloDoVolume(ULTIMO_PASSO)).toBe("6.000+");
  });

  it("entre dois passos, o volume desliza de 10 em 10", () => {
    const de100 = PASSOS.indexOf(100);
    expect(volumeDoPasso(de100)).toBe(100);
    expect(volumeDoPasso(de100 + 0.5)).toBe(130);
    expect(volumeDoPasso(de100 + 0.03)).toBe(100);
    expect(volumeDoPasso(ULTIMO_PASSO)).toBe(6000);
  });

  it("lembra só um plano do teste: o que vier de outro jeito no navegador é ignorado", () => {
    expect(planoLembrado()).toBeNull();
    lembrarPlano("avancado");
    expect(planoLembrado()).toBe("avancado");
    sessionStorage.setItem("ledgr:plano-escolhido", "escala");
    expect(planoLembrado()).toBeNull();
  });
});

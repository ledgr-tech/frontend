import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "@testing-library/react";
import { sairComSuavidade, usePresenca, useTrocaSuave } from "./troca-suave";

function painelComAnimate() {
  const elemento = document.createElement("aside");
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  Object.assign(elemento, { animate });
  return { ref: { current: elemento }, animate };
}

describe("useTrocaSuave", () => {
  it("não anima na primeira pintura, só quando a escolha muda", () => {
    const { ref, animate } = painelComAnimate();
    const { rerender } = renderHook(({ chave }) => useTrocaSuave(ref, chave), {
      initialProps: { chave: "a" },
      reactStrictMode: true,
    });
    expect(animate).not.toHaveBeenCalled();

    rerender({ chave: "b" });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenLastCalledWith(expect.any(Array), expect.objectContaining({ duration: 160 }));

    const primeiraAnimacao = animate.mock.results[0].value;
    rerender({ chave: "c" });
    expect(primeiraAnimacao.cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("sem movimento para quem pediu menos movimento: só o fade", () => {
    vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: consulta.includes("reduce") }));
    const { ref, animate } = painelComAnimate();
    const { rerender } = renderHook(({ chave }) => useTrocaSuave(ref, chave), { initialProps: { chave: "a" } });
    rerender({ chave: "b" });
    expect(animate).toHaveBeenLastCalledWith([{ opacity: 0.4 }, { opacity: 1 }], expect.any(Object));
    vi.unstubAllGlobals();
  });

  it("num navegador sem Web Animations, não faz nada", () => {
    const ref = { current: document.createElement("aside") };
    const { rerender } = renderHook(({ chave }) => useTrocaSuave(ref, chave), { initialProps: { chave: "a" } });
    expect(() => rerender({ chave: "b" })).not.toThrow();
  });
});

describe("usePresenca", () => {
  it("segura o elemento montado por ms depois de fechar, e reabrir cancela a espera", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ aberto }) => usePresenca(aberto, 100), { initialProps: { aberto: true } });
    expect(result.current).toEqual({ montado: true, saindo: false });

    rerender({ aberto: false });
    expect(result.current).toEqual({ montado: true, saindo: true });
    act(() => { vi.advanceTimersByTime(60); });
    rerender({ aberto: true });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toEqual({ montado: true, saindo: false });

    rerender({ aberto: false });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toEqual({ montado: false, saindo: false });
    vi.useRealTimers();
  });
});

describe("sairComSuavidade", () => {
  it("sem animate ou sem elemento, resolve na hora", async () => {
    await expect(sairComSuavidade(null, [], 100)).resolves.toBeUndefined();
    await expect(sairComSuavidade(document.createElement("div"), [], 100)).resolves.toBeUndefined();
  });

  it("espera a animação acabar e, com menos movimento, usa só o fade", async () => {
    vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: consulta.includes("reduce") }));
    const elemento = document.createElement("div");
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    Object.assign(elemento, { animate });
    await sairComSuavidade(elemento, [{ transform: "none" }, { transform: "scale(0.9)" }], 140, "::backdrop");
    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 1 }, { opacity: 0 }],
      expect.objectContaining({ duration: 140, fill: "forwards", pseudoElement: "::backdrop" }),
    );
    vi.unstubAllGlobals();
  });
});

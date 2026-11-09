import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTrocaSuave } from "./troca-suave";

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

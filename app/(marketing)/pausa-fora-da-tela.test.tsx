import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { PausaForaDaTela } from "./pausa-fora-da-tela";

afterEach(() => vi.unstubAllGlobals());

describe("PausaForaDaTela", () => {
  it("marks the landing sections out of view and unmarks them when they come back", () => {
    let avisar: (entradas: { target: Element; isIntersecting: boolean }[]) => void = () => {};
    const observados: Element[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof avisar) {
          avisar = cb;
        }
        observe(el: Element) {
          observados.push(el);
        }
        disconnect() {}
      },
    );
    const { container } = render(
      <div className="landing">
        <section id="a" />
        <section id="b" />
        <PausaForaDaTela />
      </div>,
    );
    const [a, b] = container.querySelectorAll("section");
    expect(observados).toEqual([a, b]);

    avisar([
      { target: a, isIntersecting: true },
      { target: b, isIntersecting: false },
    ]);
    expect(a).not.toHaveAttribute("data-fora-da-tela");
    expect(b).toHaveAttribute("data-fora-da-tela");

    avisar([{ target: b, isIntersecting: true }]);
    expect(b).not.toHaveAttribute("data-fora-da-tela");
  });
});

import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import { usePasseioNoCelular } from "./rolagem-lateral";

function Janela() {
  const caixa = useRef<HTMLDivElement>(null);
  usePasseioNoCelular(caixa, ".rola", { reduzido: true, largura: 680 });
  return (
    <div ref={caixa}>
      <div className="rola" data-testid="rola" />
    </div>
  );
}

const medir = (el: HTMLElement, scrollWidth: number, clientWidth: number) => {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
};

describe("usePasseioNoCelular", () => {
  it("marks the end of the side scroll (the hint's arrow turns back) and exposes the position as --rolado, even with reduced motion", () => {
    const { getByTestId } = render(<Janela />);
    const rola = getByTestId("rola");
    medir(rola, 800, 300);

    rola.scrollLeft = 200;
    fireEvent.scroll(rola);
    expect(rola).not.toHaveAttribute("data-no-fim");
    expect(rola.style.getPropertyValue("--rolado")).toBe("200px");

    rola.scrollLeft = 500;
    fireEvent.scroll(rola);
    expect(rola).toHaveAttribute("data-no-fim");

    rola.scrollLeft = 0;
    fireEvent.scroll(rola);
    expect(rola).not.toHaveAttribute("data-no-fim");
  });

  it("never marks the end when nothing scrolls (the computer, where the window fits)", () => {
    const { getByTestId } = render(<Janela />);
    const rola = getByTestId("rola");
    medir(rola, 300, 300);
    fireEvent.scroll(rola);
    expect(rola).not.toHaveAttribute("data-no-fim");
  });
});

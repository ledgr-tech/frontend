import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useAlturaQueDesliza } from "./medidor-suave";

afterEach(() => vi.unstubAllGlobals());

it("soma o padding vertical da caixa à altura do conteúdo", () => {
  let avisar = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        avisar = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );

  function Plano() {
    const { caixa, conteudo } = useAlturaQueDesliza("padrao");
    return (
      <div ref={caixa} data-testid="caixa" style={{ boxSizing: "border-box", padding: "0 6px 6px" }}>
        <div ref={conteudo}>Conteúdo do plano</div>
      </div>
    );
  }

  render(<Plano />);
  Object.defineProperty(screen.getByText("Conteúdo do plano"), "offsetHeight", { value: 100 });

  act(() => avisar());

  expect(screen.getByTestId("caixa").style.height).toBe("106px");
});

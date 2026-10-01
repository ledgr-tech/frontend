import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExtratoComparacao, type LinhaExtrato } from "./comparacao";

const LINHA: LinhaExtrato = {
  data: "04/10",
  desc: "Pagamento fornecedor #1082",
  valorBanco: "R$ 12.640,00",
  valorSistema: "R$ 12.604,00",
  status: "divergente_valor",
  explicacao: "O banco descontou juros por atraso.",
};

function linhaDoBanco() {
  return screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0];
}

describe("ExtratoComparacao hover", () => {
  it("shows the divergence details when hovering a mismatched line", () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

    fireEvent.mouseEnter(linhaDoBanco());

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Lançamento · Valor diverge na mesma data");
    expect(tooltip).toHaveTextContent("R$ 12.604,00");
    expect(tooltip).toHaveTextContent("juros por atraso");
    expect(linhaDoBanco()).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("marks the explanation as written by the AI, like the product does", () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

    fireEvent.mouseEnter(linhaDoBanco());

    expect(screen.getByRole("tooltip")).toHaveTextContent("Gerada por IA · confira antes de decidir");
  });

    it("only opens the hovered panel's line", () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

    fireEvent.mouseEnter(linhaDoBanco());

    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
  });

  it("highlights the matching line in the other statement", async () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
    const [banco, sistema] = screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ });

    fireEvent.mouseEnter(banco);
    expect(sistema).toHaveAttribute("data-correspondente", "true");
    expect(banco).not.toHaveAttribute("data-correspondente");

    fireEvent.mouseLeave(banco);
    await waitFor(() => expect(sistema).not.toHaveAttribute("data-correspondente"));
  });

  it("hides the details when the mouse leaves", async () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
    fireEvent.mouseEnter(linhaDoBanco());

    fireEvent.mouseLeave(linhaDoBanco());

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("marks itself as explored once a line is opened, so the hover hint can stop", () => {
    const { container } = render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
    const comparacao = container.firstElementChild!;
    expect(comparacao).not.toHaveAttribute("data-explorado");

    fireEvent.mouseEnter(linhaDoBanco());
    fireEvent.mouseLeave(linhaDoBanco());

    expect(comparacao).toHaveAttribute("data-explorado");
  });

  describe("moving from one line to the next", () => {
    const OUTRA: LinhaExtrato = { ...LINHA, desc: "Crédito cartão D+30", explicacao: "Taxa de arredondamento." };
    const linhaDe = (desc: string) => screen.getAllByRole("button", { name: new RegExp(desc) })[0];
    const cartaoDe = (desc: string) => screen.getAllByRole("tooltip").find((cartao) => cartao.textContent?.includes(desc))!;

    afterEach(() => vi.restoreAllMocks());

    it("fades the first card in", () => {
      render(<ExtratoComparacao banco={[LINHA, OUTRA]} sistema={[LINHA, OUTRA]} />);

      fireEvent.mouseEnter(linhaDe("Pagamento fornecedor"));

      expect(screen.getByRole("tooltip")).toHaveStyle({ opacity: "0" });
    });

    it("opens the next card at once when the pointer goes straight to another line", () => {
      render(<ExtratoComparacao banco={[LINHA, OUTRA]} sistema={[LINHA, OUTRA]} />);
      fireEvent.mouseEnter(linhaDe("Pagamento fornecedor"));

      fireEvent.mouseLeave(linhaDe("Pagamento fornecedor"));
      fireEvent.mouseEnter(linhaDe("Crédito cartão"));

      expect(cartaoDe("Crédito cartão")).toHaveStyle({ opacity: "1" });
    });

    it("fades in again when the pointer comes back after a pause", () => {
      const agora = vi.spyOn(performance, "now").mockReturnValue(1000);
      render(<ExtratoComparacao banco={[LINHA, OUTRA]} sistema={[LINHA, OUTRA]} />);
      fireEvent.mouseEnter(linhaDe("Pagamento fornecedor"));
      fireEvent.mouseLeave(linhaDe("Pagamento fornecedor"));

      agora.mockReturnValue(1600);
      fireEvent.mouseEnter(linhaDe("Crédito cartão"));

      expect(cartaoDe("Crédito cartão")).toHaveStyle({ opacity: "0" });
    });
  });

  it("opens on keyboard focus and closes on Escape", async () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

    fireEvent.focus(linhaDoBanco());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(linhaDoBanco(), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});

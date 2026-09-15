import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExtratoComparacao, type LinhaExtrato } from "./comparacao";

const LINHA: LinhaExtrato = {
  data: "04/10",
  desc: "Pagamento fornecedor #1082",
  valorBanco: "R$ 12.640,00",
  valorSistema: "R$ 12.604,00",
  status: "Valor divergente",
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
    expect(tooltip).toHaveTextContent("Lançamento · Valor divergente");
    expect(tooltip).toHaveTextContent("R$ 12.604,00");
    expect(tooltip).toHaveTextContent("juros por atraso");
    expect(linhaDoBanco()).toHaveAttribute("aria-describedby", tooltip.id);
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

  it("opens on keyboard focus and closes on Escape", async () => {
    render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

    fireEvent.focus(linhaDoBanco());
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(linhaDoBanco(), { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});

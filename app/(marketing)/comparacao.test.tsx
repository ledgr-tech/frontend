import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExtratoComparacao, type LinhaExtrato } from "./comparacao";

const BANCO: LinhaExtrato[] = [
  {
    data: "04/10",
    desc: "Pagamento fornecedor #1082",
    valorBanco: "R$ 12.640,00",
    valorSistema: "R$ 12.604,00",
    status: "Valor divergente",
    explicacao: "O banco descontou juros por atraso.",
  },
];

const SISTEMA: LinhaExtrato[] = [
  {
    data: "04/10",
    desc: "Pagamento fornecedor #1082",
    valorBanco: "R$ 12.640,00",
    valorSistema: "R$ 12.604,00",
    status: "Valor divergente",
    explicacao: "O banco descontou juros por atraso.",
  },
];

function abrirPainel() {
  fireEvent.click(screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0]);
}

describe("ExtratoComparacao dialog", () => {
  it("gives the divergence panel dialog semantics", () => {
    render(<ExtratoComparacao banco={BANCO} sistema={SISTEMA} />);

    abrirPainel();

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus into the panel when it opens", async () => {
    render(<ExtratoComparacao banco={BANCO} sistema={SISTEMA} />);

    abrirPainel();

    await waitFor(() => expect(screen.getByRole("button", { name: "Fechar" })).toHaveFocus());
  });

  it("closes when Escape is pressed", async () => {
    render(<ExtratoComparacao banco={BANCO} sistema={SISTEMA} />);
    abrirPainel();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("locks page scroll while open and restores it on close", async () => {
    render(<ExtratoComparacao banco={BANCO} sistema={SISTEMA} />);
    expect(document.body.style.overflow).not.toBe("hidden");

    abrirPainel();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });
});

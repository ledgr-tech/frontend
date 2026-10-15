import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IconeOrigem } from "./icone-origem";

describe("IconeOrigem", () => {
  it("draws a bank building for the bank statement, hidden from screen readers", () => {
    const { container } = render(<IconeOrigem origem="banco" />);
    const icone = container.querySelector("svg");
    expect(icone).toHaveAttribute("data-origem", "banco");
    expect(icone).toHaveClass("lucide-landmark");
    // o texto ao lado ("Extrato do banco") já diz a origem; o ícone só reforça
    expect(icone).toHaveAttribute("aria-hidden", "true");
  });

  it("draws a database for the management system", () => {
    const { container } = render(<IconeOrigem origem="sistema" />);
    const icone = container.querySelector("svg");
    expect(icone).toHaveAttribute("data-origem", "sistema");
    expect(icone).toHaveClass("lucide-database");
  });

  // também aparece na landing, fora do provedor de ícones do app: o traço vai explícito
  it("usa o traço do guia (1,75) mesmo fora do app", () => {
    const { container } = render(<IconeOrigem origem="banco" />);
    expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "1.75");
  });
});

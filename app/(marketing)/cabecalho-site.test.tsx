import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CabecalhoSite } from "./cabecalho-site";

function menu() {
  return screen.queryByRole("navigation", { name: "Menu do site" });
}

describe("CabecalhoSite", () => {
  it("keeps the full navigation for wide screens and the options menu closed", () => {
    render(<CabecalhoSite />);
    const principal = within(screen.getByRole("navigation", { name: "Navegação principal" }));
    expect(principal.getByRole("link", { name: "O problema" })).toHaveAttribute("href", "#problema");
    expect(principal.getByRole("link", { name: "Começar" })).toHaveAttribute("href", "/cadastro");

    const botao = screen.getByRole("button", { name: "Abrir menu" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(menu()).not.toBeInTheDocument();
  });

  it("opens the options menu from the Ledgr bars, with the sections and the product links", async () => {
    const user = userEvent.setup();
    render(<CabecalhoSite />);

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));

    const botao = screen.getByRole("button", { name: "Fechar menu" });
    expect(botao).toHaveAttribute("aria-expanded", "true");
    // o ícone do botão são as barras do logo, que viram um X quando o menu abre
    expect(botao.querySelectorAll("rect")).toHaveLength(3);
    const opcoes = within(menu()!);
    expect(opcoes.getByRole("link", { name: /O problema/ })).toHaveAttribute("href", "#problema");
    expect(opcoes.getByRole("link", { name: /Como funciona/ })).toHaveAttribute("href", "#como");
    expect(opcoes.getByRole("link", { name: /Assinatura/ })).toHaveAttribute("href", "#preco");
    expect(opcoes.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(opcoes.getByRole("link", { name: "Começar" })).toHaveAttribute("href", "/cadastro");
  });

  it("closes the menu after choosing an option", async () => {
    const user = userEvent.setup();
    render(<CabecalhoSite />);
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));

    await user.click(within(menu()!).getByRole("link", { name: /Como funciona/ }));

    expect(menu()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape, returning focus to the menu button", async () => {
    const user = userEvent.setup();
    render(<CabecalhoSite />);
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));

    await user.keyboard("{Escape}");

    expect(menu()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveFocus();
  });

  it("closes when tapping outside the header", async () => {
    const user = userEvent.setup();
    render(
      <>
        <CabecalhoSite />
        <p>conteúdo da página</p>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Abrir menu" }));

    await user.click(screen.getByText("conteúdo da página"));

    expect(menu()).not.toBeInTheDocument();
  });
});

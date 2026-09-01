import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import LandingPage from "./page";

describe("LandingPage", () => {
  it("shows the hero headline and a link into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { name: "Pare de conciliar extrato à mão." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conciliar meu primeiro extrato" })
    ).toHaveAttribute("href", "/login");
  });

  it("states the golden rule and the pricing model", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("O extrato do banco é sempre a fonte da verdade.")
    ).toBeInTheDocument();
    expect(screen.getByText("Preço fechado, por volume.")).toBeInTheDocument();
  });

  it("has a header with nav links into the product and to the page sections", () => {
    const { container } = render(<LandingPage />);
    const header = within(container.querySelector("header")!);
    expect(header.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    expect(header.getByRole("link", { name: "Começar" })).toHaveAttribute("href", "/login");
    expect(header.getByRole("link", { name: "O problema" })).toHaveAttribute("href", "#problema");
    expect(header.getByRole("link", { name: "Como funciona" })).toHaveAttribute("href", "#como");
    expect(header.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "#preco");
  });

  it("shows the em números stats", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("dos lançamentos casaram sem ninguém conferir")
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 214.380")).toBeInTheDocument();
    expect(
      screen.getByText(/Um mês de indústria conciliado no Ledgr/)
    ).toBeInTheDocument();
  });

  it("shows the bank vs. system statement comparison with a mismatch", () => {
    render(<LandingPage />);
    expect(screen.getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 12.604,00")).toBeInTheDocument();
  });

  it("lists the three how-it-works steps", () => {
    render(<LandingPage />);
    expect(screen.getByText("Suba o extrato do banco")).toBeInTheDocument();
    expect(screen.getByText("Suba o extrato do sistema")).toBeInTheDocument();
    expect(screen.getByText("Receba as divergências")).toBeInTheDocument();
  });

  it("invites early companies with a CTA into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("Estamos abrindo o Ledgr para um grupo pequeno de empresas.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quero conciliar meu mês" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("answers the two FAQ questions", () => {
    render(<LandingPage />);
    expect(screen.getByText("Quem decide o que é divergência?")).toBeInTheDocument();
    expect(screen.getByText("O contador consegue acessar?")).toBeInTheDocument();
  });

  it("lists all four pricing tiers", () => {
    render(<LandingPage />);
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("R$ 79,90")).toBeInTheDocument();
    expect(screen.getByText("Avançado")).toBeInTheDocument();
    expect(screen.getByText("R$ 99,90")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });

  it("has a footer with page links and the copyright line", () => {
    const { container } = render(<LandingPage />);
    const footer = within(container.querySelector("footer")!);
    expect(footer.getByRole("link", { name: "Como funciona" })).toHaveAttribute("href", "#como");
    expect(footer.getByRole("link", { name: "Regra de ouro" })).toHaveAttribute("href", "#regra");
    expect(footer.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "#preco");
    expect(screen.getByText("© 2026 Ledgr · Passo Fundo, RS")).toBeInTheDocument();
  });
});

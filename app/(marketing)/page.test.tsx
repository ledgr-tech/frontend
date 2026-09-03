import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      screen.getByText("a maior parte dos lançamentos casa sem precisar mexer em nada")
    ).toBeInTheDocument();
    expect(
      screen.getByText("para ter o relatório pronto após subir os arquivos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("nenhuma integração bancária pra configurar")
    ).toBeInTheDocument();
  });

  it("shows the bank vs. system statement comparison with a mismatch", () => {
    render(<LandingPage />);
    expect(screen.getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 12.604,00")).toBeInTheDocument();
  });

  it("names each line's reconciliation status with one consistent vocabulary", () => {
    render(<LandingPage />);
    expect(screen.getAllByText("Batido")).toHaveLength(2);
    expect(screen.getAllByText("Valor divergente")).toHaveLength(4);
    expect(screen.getAllByText("Data divergente")).toHaveLength(2);
    expect(screen.getByText("Sem correspondente")).toBeInTheDocument();
  });

  it("opens a dialog explaining the divergence when a mismatched line is clicked", () => {
    render(<LandingPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0]);

    expect(screen.getByText(/juros por atraso/)).toBeInTheDocument();
  });

  it("does not treat a matched (Batido) line as clickable", () => {
    render(<LandingPage />);

    expect(screen.queryByRole("button", { name: /Recebimento cliente Alfa Comércio/ })).not.toBeInTheDocument();
  });

  it("closes the divergence dialog when Fechar is clicked", async () => {
    render(<LandingPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /Pagamento fornecedor #1082/ })[0]);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() => expect(screen.queryByText(/juros por atraso/)).not.toBeInTheDocument());
  });

  it("lists the three how-it-works steps", () => {
    render(<LandingPage />);
    expect(screen.getByText("Suba os extratos dos bancos")).toBeInTheDocument();
    expect(screen.getByText("Suba o extrato do sistema")).toBeInTheDocument();
    expect(screen.getByText("Receba as divergências")).toBeInTheDocument();
  });

  it("invites early companies with a CTA into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("Suba os arquivos e veja as divergências em minutos.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Testar agora, gratuito" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("answers the FAQ questions", () => {
    render(<LandingPage />);
    expect(screen.getByText("Preciso instalar algo no meu banco?")).toBeInTheDocument();
    expect(screen.getByText("E se o meu ERP não estiver na lista?")).toBeInTheDocument();
    expect(screen.getByText("Quem decide o que é divergência?")).toBeInTheDocument();
    expect(screen.getByText("O contador consegue acessar?")).toBeInTheDocument();
  });

  it("lists all five pricing tiers, covering the volume shown in the hero demo", () => {
    render(<LandingPage />);
    expect(screen.getByText("Essencial")).toBeInTheDocument();
    expect(screen.getByText("R$ 49,90")).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("R$ 79,90")).toBeInTheDocument();
    expect(screen.getByText("Avançado")).toBeInTheDocument();
    expect(screen.getByText("R$ 99,90")).toBeInTheDocument();
    expect(screen.getByText("Escala")).toBeInTheDocument();
    expect(screen.getByText("R$ 149,90")).toBeInTheDocument();
    expect(screen.getByText("até 5.000 lançamentos por mês")).toBeInTheDocument();
    expect(screen.getByText("Volume")).toBeInTheDocument();
    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/login");
  });

  it("has a footer organized into Produto, Empresa and Legal link columns", () => {
    const { container } = render(<LandingPage />);
    const footer = within(container.querySelector("footer")!);
    expect(footer.getByText("Produto")).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Como funciona" })).toHaveAttribute("href", "#como");
    expect(footer.getByRole("link", { name: "Regra de ouro" })).toHaveAttribute("href", "#regra");
    expect(footer.getByRole("link", { name: "Perguntas" })).toHaveAttribute("href", "#perguntas");
    expect(footer.getByText("Empresa")).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "#preco");
    expect(footer.getByRole("link", { name: "Contato" })).toHaveAttribute("href", "mailto:ola@ledgr.com.br");
    expect(footer.getByRole("link", { name: "Segurança" })).toHaveAttribute("href", "#regra");
    expect(footer.getByText("Legal")).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Termos de uso" })).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "Privacidade" })).toBeInTheDocument();
    expect(footer.getByRole("link", { name: "LGPD" })).toBeInTheDocument();
    expect(screen.getByText("© 2026 Ledgr · Passo Fundo, RS")).toBeInTheDocument();
  });
});

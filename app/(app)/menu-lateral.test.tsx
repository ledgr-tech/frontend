import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuLateral } from "./menu-lateral";

const caminho = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => caminho(),
}));

vi.mock("@/lib/mock-data", () => ({ EMPRESA_MOCK: "Telha Certa" }));

const EMAIL = "financeiro@telhacerta.com.br";

function montar(props: Partial<Parameters<typeof MenuLateral>[0]> = {}) {
  return render(<MenuLateral email={EMAIL} onSair={vi.fn()} {...props} />);
}

describe("MenuLateral", () => {
  beforeEach(() => {
    caminho.mockReturnValue("/dashboard");
    window.localStorage.clear();
    delete document.documentElement.dataset.menu;
    delete document.documentElement.dataset.tema;
  });

  it("opens with Visão geral, then the five destinations from the design, in order", () => {
    montar();

    const nav = screen.getByRole("navigation", { name: "Seções do app" });
    expect(nav.textContent).toBe("Visão geralExtratosConciliaçõesFechamentosHistóricoAssinatura");
  });

  it("links every destination, with none left for later", () => {
    montar();

    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("href", "/visao-geral");
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Histórico" })).toHaveAttribute("href", "/historico");
    expect(screen.getByRole("link", { name: "Extratos" })).toHaveAttribute("href", "/extratos");
    expect(screen.getByRole("link", { name: "Fechamentos" })).toHaveAttribute("href", "/fechamentos");
    expect(screen.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "/assinatura");
    expect(screen.getByRole("navigation", { name: "Seções do app" })).not.toHaveTextContent("em breve");
  });

  it.each([
    ["Fechamentos", "/fechamentos"],
    ["Assinatura", "/assinatura"],
  ])("marks %s as current on its own route", (nome, rota) => {
    caminho.mockReturnValue(rota);
    montar();
    expect(screen.getByRole("link", { name: nome })).toHaveAttribute("aria-current", "page");
  });

  it("marks Visão geral as current on its own route", () => {
    caminho.mockReturnValue("/visao-geral");
    montar();
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Conciliações" })).not.toHaveAttribute("aria-current");
  });

  it("marks Extratos as current on its own route", () => {
    caminho.mockReturnValue("/extratos");
    montar();
    expect(screen.getByRole("link", { name: "Extratos" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Conciliações as the current page on the dashboard", () => {
    montar();
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Conciliações current on the nested conciliação routes", () => {
    caminho.mockReturnValue("/conciliacoes/conc-1/lc-2");
    montar();
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Histórico" })).not.toHaveAttribute("aria-current");
  });

  it("marks Histórico as current on its own route", () => {
    caminho.mockReturnValue("/historico");
    montar();
    expect(screen.getByRole("link", { name: "Histórico" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Conciliações" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing as current on a route outside the menu", () => {
    caminho.mockReturnValue("/regras");
    montar();
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("puts Nova conciliação above the destinations", () => {
    montar();

    const nova = screen.getByRole("link", { name: "Nova conciliação" });
    expect(nova).toHaveAttribute("href", "/conciliacoes/nova");
    const nav = screen.getByRole("navigation", { name: "Seções do app" });
    expect(nova.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens with the brand, without the mascot, the aviso line or the way back to the site", () => {
    montar();

    expect(screen.getByText("Ledgr")).toBeInTheDocument();
    expect(screen.queryByText("tudo em ordem")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver o site" })).not.toBeInTheDocument();
  });

  it("collapses and opens from its own buttons", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(document.documentElement.dataset.menu).toBe("recolhido");

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(document.documentElement.dataset.menu).toBe("aberto");
  });

  it("hands the focus to the button that takes the clicked one's place", async () => {
    // o CSS esconde o botão clicado; sem isto o foco cairia no <body>
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByRole("button", { name: "Recolher menu" })).toHaveFocus();
  });

  it("collapses and opens with Ctrl+B", async () => {
    const user = userEvent.setup();
    montar();

    await user.keyboard("{Control>}b{/Control}");
    expect(document.documentElement.dataset.menu).toBe("recolhido");

    await user.keyboard("{Control>}b{/Control}");
    expect(document.documentElement.dataset.menu).toBe("aberto");
  });

  it("offers the theme toggle as an icon, named after where it goes", async () => {
    const user = userEvent.setup();
    montar();

    const botao = await screen.findByRole("button", { name: "Tema escuro" });
    expect(botao.textContent).toBe("");
    await user.click(botao);

    expect(document.documentElement.dataset.tema).toBe("escuro");
    expect(screen.getByRole("button", { name: "Tema claro" })).toBeInTheDocument();
  });

  it("shows the assistant as coming soon, with nothing to click", () => {
    montar();

    expect(screen.getByText("Fale com o Ledgr")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fale com o Ledgr/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Fale com o Ledgr/ })).not.toBeInTheDocument();
  });

  it("derives the user label and initials from the session email, next to the empresa", () => {
    montar();

    const conta = screen.getByRole("button", { name: /Financeiro/ });
    expect(within(conta).getByText("FI")).toBeInTheDocument();
    expect(within(conta).getByText("Telha Certa")).toBeInTheDocument();
  });

  it("opens the account menu with the email and the logout", async () => {
    const onSair = vi.fn();
    const user = userEvent.setup();
    montar({ onSair });

    const conta = screen.getByRole("button", { name: /Financeiro/ });
    expect(conta).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();

    await user.click(conta);
    expect(conta).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(EMAIL)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(onSair).toHaveBeenCalled();
  });

  it("closes the account menu on Escape", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Financeiro/ }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });
});

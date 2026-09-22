import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MenuLateral } from "./menu-lateral";

const caminho = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => caminho(),
}));

vi.mock("@/lib/mock-data", () => ({ EMPRESA_MOCK: "Telha Certa" }));

describe("MenuLateral", () => {
  it("lists the five destinations from the design, in order", () => {
    caminho.mockReturnValue("/dashboard");
    render(<MenuLateral temAvisoNaoLido={false} />);

    const nav = screen.getByRole("navigation", { name: "Seções do app" });
    expect(nav.textContent).toBe("ExtratosConciliaçõesFechamentosHistóricoAssinatura");
  });

  it("links only the destinations that already exist", () => {
    caminho.mockReturnValue("/dashboard");
    render(<MenuLateral temAvisoNaoLido={false} />);

    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Histórico" })).toHaveAttribute("href", "/historico");
    expect(screen.queryByRole("link", { name: "Extratos" })).not.toBeInTheDocument();
    expect(screen.getByText("Extratos")).toHaveAttribute("aria-disabled", "true");
  });

  it("marks Conciliações as the current page on the dashboard", () => {
    caminho.mockReturnValue("/dashboard");
    render(<MenuLateral temAvisoNaoLido={false} />);
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Conciliações current on the nested conciliação routes", () => {
    caminho.mockReturnValue("/conciliacoes/conc-1/lc-2");
    render(<MenuLateral temAvisoNaoLido={false} />);
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Histórico" })).not.toHaveAttribute("aria-current");
  });

  it("marks Histórico as current on its own route", () => {
    caminho.mockReturnValue("/historico");
    render(<MenuLateral temAvisoNaoLido={false} />);
    expect(screen.getByRole("link", { name: "Histórico" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Conciliações" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing as current on a route outside the menu", () => {
    caminho.mockReturnValue("/regras");
    render(<MenuLateral temAvisoNaoLido={false} />);
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("swaps the aviso line and the dot with the unread state", () => {
    caminho.mockReturnValue("/dashboard");
    const { rerender } = render(<MenuLateral temAvisoNaoLido />);
    expect(screen.getByText("3 avisos para você")).toBeInTheDocument();

    rerender(<MenuLateral temAvisoNaoLido={false} />);
    expect(screen.getByText("tudo em ordem")).toBeInTheDocument();
  });

  it("shows the empresa and a way back to the site", () => {
    caminho.mockReturnValue("/dashboard");
    render(<MenuLateral temAvisoNaoLido={false} />);
    expect(screen.getByText("Telha Certa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver o site" })).toHaveAttribute("href", "/");
  });
});

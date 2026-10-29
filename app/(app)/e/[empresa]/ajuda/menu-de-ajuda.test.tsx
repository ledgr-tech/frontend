import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuDeAjuda } from "./menu-de-ajuda";

let caminho = "/conciliacoes/nova";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

function ouvir(evento: string) {
  const ouvinte = vi.fn();
  window.addEventListener(evento, ouvinte);
  return { ouvinte, parar: () => window.removeEventListener(evento, ouvinte) };
}

describe("MenuDeAjuda", () => {
  afterEach(() => {
    caminho = "/conciliacoes/nova";
  });

  it("numa tela com página, oferece a ajuda dela, o tutorial e a Central", async () => {
    const user = userEvent.setup();
    render(<MenuDeAjuda />);
    const botao = screen.getByRole("button", { name: "Ajuda" });
    expect(botao).toHaveAttribute("aria-expanded", "false");

    await user.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: /Ajuda desta tela/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Rever o tutorial/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Central de ajuda/ }),
    ).toHaveAttribute("href", "/ajuda/nova-conciliacao");
  });

  it('"Ajuda desta tela" abre o painel e fecha o menu', async () => {
    const { ouvinte, parar } = ouvir("ledgr:abrir-ajuda");
    const user = userEvent.setup();
    render(<MenuDeAjuda />);
    await user.click(screen.getByRole("button", { name: "Ajuda" }));
    await user.click(screen.getByRole("button", { name: /Ajuda desta tela/ }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /Rever o tutorial/ }),
    ).not.toBeInTheDocument();
    parar();
  });

  it("numa tela sem tutorial, só a Central", async () => {
    caminho = "/assinatura";
    const user = userEvent.setup();
    render(<MenuDeAjuda />);
    await user.click(screen.getByRole("button", { name: "Ajuda" }));
    expect(
      screen.queryByRole("button", { name: /Rever o tutorial/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Central de ajuda/ }),
    ).toBeInTheDocument();
  });

  it("Esc fecha o menu e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    render(<MenuDeAjuda />);
    const botao = screen.getByRole("button", { name: "Ajuda" });
    await user.click(botao);
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("link", { name: /Central de ajuda/ }),
    ).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});

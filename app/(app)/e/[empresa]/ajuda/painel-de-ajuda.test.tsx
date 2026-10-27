import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { abrirAjuda } from "@/lib/eventos";
import { PainelDaRota } from "./painel-de-ajuda";

let caminho = "/conciliacoes/nova";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

describe("PainelDaRota", () => {
  afterEach(() => {
    caminho = "/conciliacoes/nova";
  });

  it('fica fechado até o "Ajuda desta tela", e abre com a ajuda da tela do endereço', () => {
    render(<PainelDaRota />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => abrirAjuda());
    const painel = screen.getByRole("dialog", {
      name: "Ajuda: Nova conciliação",
    });
    expect(
      screen.getByRole("heading", { name: "Nova conciliação" }),
    ).toHaveFocus();
    // cada funcionalidade da tela, com o link para a seção dela na Central
    expect(painel).toHaveTextContent("Enviar os dois extratos");
    expect(
      screen.getByRole("link", { name: /^Apontar as colunas do CSV/ }),
    ).toHaveAttribute("href", "/ajuda/nova-conciliacao#apontar-colunas");
    expect(
      screen.getByRole("link", { name: /Abrir a página completa/ }),
    ).toHaveAttribute("href", "/ajuda/nova-conciliacao");
    // sem gravação, sem player vazio
    expect(painel.querySelector("video")).toBeNull();
  });

  it("na linha da comparação, é a ajuda do detalhe da linha", () => {
    caminho = "/conciliacoes/b/lc-1";
    render(<PainelDaRota />);
    act(() => abrirAjuda());
    expect(
      screen.getByRole("dialog", { name: "Ajuda: Detalhe da linha" }),
    ).toBeInTheDocument();
  });

  it("onde não há página, não abre nada", () => {
    caminho = "/assinatura";
    render(<PainelDaRota />);
    act(() => abrirAjuda());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fecha pelo X e pelo Esc", async () => {
    const user = userEvent.setup();
    render(<PainelDaRota />);
    act(() => abrirAjuda());
    await user.click(screen.getByRole("button", { name: "Fechar a ajuda" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => abrirAjuda());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

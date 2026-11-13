import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PainelLateral } from "./painel-lateral";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

describe("PainelLateral", () => {
  beforeEach(() => back.mockReset());

  it("is a dialog over the page, with the content inside", () => {
    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);
    const painel = screen.getByRole("dialog", { name: "Lançamento" });
    expect(painel).toHaveAttribute("aria-modal", "true");
    expect(painel).toHaveTextContent("conteúdo");
  });

  it("closes with Escape and with a click outside, going back in the history", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    unmount();

    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);
    await user.click(screen.getByTestId("painel-fundo"));
    await waitFor(() => expect(back).toHaveBeenCalledTimes(2));
  });

  it("fecha uma vez só, mesmo com Esc e clique no fundo em seguida", async () => {
    const user = userEvent.setup();
    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);

    await user.keyboard("{Escape}");
    await user.click(screen.getByTestId("painel-fundo"));
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it("does not close on a click inside", async () => {
    const user = userEvent.setup();
    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);

    await user.click(screen.getByText("conteúdo"));
    expect(back).not.toHaveBeenCalled();
  });

  it("rola sem barra: o \"Mais abaixo\" aparece enquanto há conteúdo fora da vista", () => {
    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);
    const caixa = document.querySelector<HTMLElement>(".painel-rolagem")!;
    const mais = document.querySelector(".comp-mais")!;
    expect(caixa).toHaveFocus();
    Object.defineProperty(caixa, "scrollHeight", { configurable: true, value: 900 });
    Object.defineProperty(caixa, "clientHeight", { configurable: true, value: 500 });

    fireEvent.scroll(caixa);
    expect(mais).toHaveAttribute("data-visivel");

    caixa.scrollTop = 400;
    fireEvent.scroll(caixa);
    expect(mais).not.toHaveAttribute("data-visivel");
    expect(caixa).toHaveAttribute("data-acima");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);

    await user.keyboard("{Escape}");
    expect(back).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("painel-fundo"));
    expect(back).toHaveBeenCalledTimes(2);
  });

  it("does not close on a click inside", async () => {
    const user = userEvent.setup();
    render(<PainelLateral rotulo="Lançamento"><p>conteúdo</p></PainelLateral>);

    await user.click(screen.getByText("conteúdo"));
    expect(back).not.toHaveBeenCalled();
  });
});

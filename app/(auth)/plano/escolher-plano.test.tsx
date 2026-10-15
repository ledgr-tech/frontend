import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscolherPlano } from "./escolher-plano";

const escolherPlano = vi.fn();
vi.mock("../acoes", () => ({ escolherPlano: (p: string) => escolherPlano(p) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("EscolherPlano", () => {
  it("mostra os três planos e o teste sem cartão", () => {
    render(<EscolherPlano />);
    expect(screen.getByRole("heading", { name: "Escolha seu plano." })).toBeInTheDocument();
    expect(screen.getByText(/14 dias grátis, sem cartão/)).toBeInTheDocument();
    for (const nome of ["Essencial", "Padrão", "Avançado"]) {
      expect(screen.getByRole("button", { name: `Começar com o ${nome}` })).toBeInTheDocument();
    }
  });

  it("escolher abre a Visão geral", async () => {
    escolherPlano.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EscolherPlano />);
    await user.click(screen.getByRole("button", { name: "Começar com o Padrão" }));
    expect(escolherPlano).toHaveBeenCalledWith("padrao");
    expect(push).toHaveBeenCalledWith("/visao-geral");
  });

  it("se falhar, mostra o motivo e libera os botões", async () => {
    escolherPlano.mockResolvedValue({ ok: false, erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função." });
    const user = userEvent.setup();
    render(<EscolherPlano />);
    await user.click(screen.getByRole("button", { name: "Começar com o Essencial" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ainda não disponível");
    expect(screen.getByRole("button", { name: "Começar com o Essencial" })).toBeEnabled();
  });
});

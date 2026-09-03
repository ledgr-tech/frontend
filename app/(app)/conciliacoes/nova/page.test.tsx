import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NovaConciliacaoPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const criarConciliacao = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  criarConciliacao: () => criarConciliacao(),
}));

function arquivo(nome: string) {
  return new File(["conteudo"], nome, { type: "text/csv" });
}

describe("NovaConciliacaoPage", () => {
  beforeEach(() => {
    push.mockClear();
    criarConciliacao.mockReset();
    criarConciliacao.mockReturnValue({ id: "conc-123", mes: "Setembro 2026", status: "em_andamento", linhas: [] });
  });

  it("disables the submit button until both files are selected", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    const botao = screen.getByRole("button", { name: "Conciliar extratos" });
    expect(botao).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
    expect(botao).toBeDisabled();

    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    expect(botao).toBeEnabled();
  });

  it("creates a conciliação and navigates to it on submit", async () => {
    const user = userEvent.setup();
    render(<NovaConciliacaoPage />);

    await user.upload(screen.getByLabelText("Extrato do banco"), arquivo("banco.ofx"));
    await user.upload(screen.getByLabelText("Extrato do sistema de gestão"), arquivo("sistema.csv"));
    await user.click(screen.getByRole("button", { name: "Conciliar extratos" }));

    expect(criarConciliacao).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/conciliacoes/conc-123");
  });
});

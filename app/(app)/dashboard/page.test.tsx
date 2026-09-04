import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

const listarConciliacoes = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  EMPRESA_MOCK: "Telha Certa",
  listarConciliacoes: () => listarConciliacoes(),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    listarConciliacoes.mockReset();
  });

  it("shows the empty state when there are no conciliações", async () => {
    listarConciliacoes.mockReturnValue([]);
    render(<DashboardPage />);
    expect(await screen.findByText("Nenhum extrato por aqui ainda.")).toBeInTheDocument();
  });

  it("shows recent conciliações when at least one exists", async () => {
    listarConciliacoes.mockReturnValue([
      { id: "conc-1", mes: "Setembro 2026", status: "fechada", linhas: [] },
    ]);
    render(<DashboardPage />);
    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.getByText("Setembro 2026")).toBeInTheDocument();
  });
});

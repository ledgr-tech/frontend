import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Conciliacao, LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import DashboardPage from "./page";

const listarConciliacoes = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  EMPRESA_MOCK: "Telha Certa",
  listarConciliacoes: () => listarConciliacoes(),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

function linha(
  id: string,
  status: StatusLinha,
  valorBanco: number | null,
  valorSistema: number | null,
  descricao = "Lançamento",
): LinhaComparacao {
  return {
    id,
    descricao,
    data: "04/09",
    valorBanco,
    valorSistema,
    status,
    explicacao: null,
    historico: [],
  };
}

function conciliacao(id: string, linhas: LinhaComparacao[]): Conciliacao {
  return { id, mes: "Setembro 2026", status: "em_andamento", linhas };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    listarConciliacoes.mockReset();
  });

  it("shows the empty state when there are no conciliações", async () => {
    listarConciliacoes.mockReturnValue([]);
    render(<DashboardPage />);
    expect(await screen.findByText("Nenhum extrato por aqui ainda.")).toBeInTheDocument();
    expect(screen.queryByText("O que o Ledgr sugere")).not.toBeInTheDocument();
  });

  it("derives the summary row from the conciliação linhas", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-1", [
        linha("l-1", "match_exato", 7300, 7300),
        linha("l-2", "divergente_valor", 12640, 12604),
        linha("l-3", "sem_correspondencia", 4180, null),
        linha("l-4", "sem_correspondencia", null, 2150),
      ]),
    ]);
    render(<DashboardPage />);

    expect(await screen.findByText("Lançamentos processados")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("25,0%")).toBeInTheDocument();
    // 36 da divergência de valor + 4.180 + 2.150 das órfãs
    expect(screen.getByText("R$ 6.366")).toBeInTheDocument();
    expect(screen.getByText("Distribuído em 3 lançamentos")).toBeInTheDocument();
  });

  it("labels each lançamento with the status wording from the design", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-1", [
        linha("l-1", "match_exato", 7300, 7300, "Pagamento Vale Verde"),
        linha("l-2", "divergente_valor", 12640, 12604, "Boleto Aço Norte"),
        linha("l-3", "sem_correspondencia", 4180, null, "Transferência recebida"),
      ]),
    ]);
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.getByText("Match exato")).toBeInTheDocument();
    expect(screen.getByText("Valor diverge na mesma data")).toBeInTheDocument();
    expect(screen.getByText("Sem correspondência no sistema")).toBeInTheDocument();
    // a origem é o banco sempre que o banco tem a linha
    expect(screen.getAllByText("Banco")).toHaveLength(3);
  });

  it("points the highlight card at the linhas without a counterpart", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-9", [
        linha("l-1", "sem_correspondencia", 4180, null),
        linha("l-2", "sem_correspondencia", null, 2150),
      ]),
    ]);
    render(<DashboardPage />);

    expect(await screen.findByText("Comece pelas 2 sem correspondente")).toBeInTheDocument();
    // vai direto para a primeira divergência em aberto, não para a lista
    expect(screen.getByRole("link", { name: "Revisar agora" })).toHaveAttribute(
      "href",
      "/conciliacoes/conc-9/l-1",
    );
  });

  it("points each suggestion at the screen that resolves it", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-1", [linha("l-1", "divergente_valor", 12640, 12604)]),
    ]);
    render(<DashboardPage />);

    expect(await screen.findByRole("link", { name: "Ver o caso" })).toHaveAttribute(
      "href",
      "/conciliacoes/conc-1/l-1",
    );
    expect(screen.getByRole("link", { name: "Criar regra" })).toHaveAttribute("href", "/regras");
    expect(screen.getByRole("link", { name: "Ver histórico" })).toHaveAttribute("href", "/historico");
  });

  it("drops the Ver o caso link when every linha is already matched", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-1", [linha("l-1", "match_exato", 100, 100)]),
    ]);
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver o caso" })).not.toBeInTheDocument();
    // as outras duas não dependem da conciliação e continuam
    expect(screen.getByRole("link", { name: "Criar regra" })).toBeInTheDocument();
  });

  it("hides the highlight card when every linha has a counterpart", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-1", [linha("l-1", "match_exato", 100, 100)]),
    ]);
    render(<DashboardPage />);

    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.queryByText(/sem correspondente$/)).not.toBeInTheDocument();
  });

  it("only lists earlier conciliações when there is more than one", async () => {
    listarConciliacoes.mockReturnValue([
      conciliacao("conc-2", [linha("l-1", "match_exato", 100, 100)]),
    ]);
    const { unmount } = render(<DashboardPage />);
    expect(await screen.findByText("Conciliações recentes")).toBeInTheDocument();
    expect(screen.queryByText("Conciliações anteriores")).not.toBeInTheDocument();
    unmount();

    listarConciliacoes.mockReturnValue([
      conciliacao("conc-2", [linha("l-1", "match_exato", 100, 100)]),
      { ...conciliacao("conc-1", [linha("l-2", "match_exato", 200, 200)]), status: "fechada" },
    ]);
    render(<DashboardPage />);
    expect(await screen.findByText("Conciliações anteriores")).toBeInTheDocument();
    expect(screen.getByText("Fechada")).toBeInTheDocument();
  });
});

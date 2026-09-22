import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Conciliacao } from "@/lib/mock-data";
import ConciliacaoPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "conc-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const buscarConciliacao = vi.fn();
const fecharConciliacao = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  buscarConciliacao: (id: string) => buscarConciliacao(id),
  fecharConciliacao: (id: string) => fecharConciliacao(id),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

const conciliacaoEmAndamento: Conciliacao = {
  id: "conc-1",
  mes: "Setembro 2026",
  status: "em_andamento",
  linhas: [
    {
      id: "lc-1",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "divergencia_valor",
      explicacao: "Juros de dois dias de atraso não lançados no sistema.",
      historico: [{ quando: "04/09", evento: "Pago no banco com juros de atraso" }],
    },
  ],
};

const conciliacaoFechada: Conciliacao = {
  id: "conc-1",
  mes: "Setembro 2026",
  status: "fechada",
  linhas: [
    {
      id: "lc-1",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "batido",
      explicacao: "Juros de dois dias de atraso não lançados no sistema.",
      historico: [{ quando: "04/09", evento: "Pago no banco com juros de atraso" }],
    },
  ],
};

const conciliacaoMista: Conciliacao = {
  id: "conc-1",
  mes: "Setembro 2026",
  status: "em_andamento",
  linhas: [
    {
      id: "lc-1",
      descricao: "Pagamento batido",
      data: "02/09",
      valorBanco: 7300,
      valorSistema: 7300,
      status: "batido",
      explicacao: null,
      historico: [],
    },
    {
      id: "lc-2",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "divergencia_valor",
      explicacao: "Juros de dois dias de atraso não lançados no sistema.",
      historico: [],
    },
  ],
};

describe("ConciliacaoPage", () => {
  beforeEach(() => {
    buscarConciliacao.mockReset();
    fecharConciliacao.mockReset();
  });

  it("lists comparison rows for a conciliação em andamento", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);
    expect(await screen.findByText("Comparação direta")).toBeInTheDocument();
    expect(screen.getByText("Boleto Aço Norte Bobinas")).toBeInTheDocument();
  });

  it("opens the transaction dialog with its explanation when a row is clicked", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    await user.click(await screen.findByText("Boleto Aço Norte Bobinas"));
    expect(
      screen.getByText("Juros de dois dias de atraso não lançados no sistema.")
    ).toBeInTheDocument();
  });

  it("shows the fechamento success view when the conciliação is fechada", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoFechada);
    render(<ConciliacaoPage />);
    expect(
      await screen.findByText("Setembro 2026 fechou sem divergência pendente.")
    ).toBeInTheDocument();
  });

  it("closes the month when Fechar mês is clicked", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    fecharConciliacao.mockReturnValue({ ...conciliacaoEmAndamento, status: "fechada" });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    await user.click(await screen.findByText("Fechar mês"));

    expect(fecharConciliacao).toHaveBeenCalledWith("conc-1");
    expect(
      await screen.findByText("Setembro 2026 fechado com 1 item revisado.")
    ).toBeInTheDocument();
  });

  it("shows not found message when conciliação does not exist", async () => {
    buscarConciliacao.mockReturnValue(null);
    render(<ConciliacaoPage />);
    expect(
      await screen.findByText("Conciliação não encontrada.")
    ).toBeInTheDocument();
  });

  it("shows a skeleton while loading instead of a blank screen", () => {
    buscarConciliacao.mockReturnValue(undefined);
    const { container } = render(<ConciliacaoPage />);
    expect(container.querySelector("[aria-busy=\"true\"]")).not.toBeNull();
  });

  it("filters down to the linhas that need review", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoMista);
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    expect(await screen.findByText("Pagamento batido")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Só revisão (1)" }));

    expect(screen.queryByText("Pagamento batido")).not.toBeInTheDocument();
    expect(screen.getByText("Boleto Aço Norte Bobinas")).toBeInTheDocument();
  });

  it("explains an empty filter result", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoMista,
      linhas: conciliacaoMista.linhas.filter((linha) => linha.status === "batido"),
    });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    await user.click(await screen.findByRole("button", { name: "Só revisão (0)" }));
    expect(screen.getByText(/todos os lançamentos bateram/)).toBeInTheDocument();
  });

  it("sorts by a column and flips the direction on a second click", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoMista);
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    const cabecalho = await screen.findByRole("button", { name: /Banco/ });
    await user.click(cabecalho);
    expect(cabecalho.closest("th")).toHaveAttribute("aria-sort", "ascending");

    await user.click(cabecalho);
    expect(cabecalho.closest("th")).toHaveAttribute("aria-sort", "descending");
  });

  it("paginates past the page size and keeps the count honest", async () => {
    const muitas = Array.from({ length: 30 }, (_, i) => ({
      id: `l-${i}`,
      descricao: `Lançamento ${i}`,
      data: "04/09",
      valorBanco: 100 + i,
      valorSistema: 100 + i,
      status: "batido" as const,
      explicacao: null,
      historico: [],
    }));
    buscarConciliacao.mockReturnValue({ ...conciliacaoMista, linhas: muitas });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    expect(await screen.findByText("1–25 de 30")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("26–30 de 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
  });
});

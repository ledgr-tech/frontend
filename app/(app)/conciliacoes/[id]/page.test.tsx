import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Conciliacao } from "@/lib/mock-data";
import ConciliacaoPage from "./page";

// hoisted porque a fábrica do vi.mock roda antes das declarações do módulo
const rota = vi.hoisted(() => ({ id: "conc-1" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: rota.id }),
  useRouter: () => ({ push: vi.fn() }),
}));

const carregarConciliacao = vi.fn();
vi.mock("../acoes", () => ({
  carregarConciliacao: (id: string) => carregarConciliacao(id),
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
      status: "divergente_valor",
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
      status: "match_exato",
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
      status: "match_exato",
      explicacao: null,
      historico: [],
    },
    {
      id: "lc-2",
      descricao: "Boleto Aço Norte Bobinas",
      data: "04/09",
      valorBanco: 12640,
      valorSistema: 12604,
      status: "divergente_valor",
      explicacao: "Juros de dois dias de atraso não lançados no sistema.",
      historico: [],
    },
  ],
};

describe("ConciliacaoPage", () => {
  beforeEach(() => {
    rota.id = "conc-1";
    buscarConciliacao.mockReset();
    fecharConciliacao.mockReset();
    carregarConciliacao.mockReset();
    window.localStorage.clear();
    delete document.documentElement.dataset.densidade;
  });

  it("lists comparison rows for a conciliação em andamento", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);
    expect(await screen.findByText("Comparação direta")).toBeInTheDocument();
    expect(screen.getByText("Boleto Aço Norte Bobinas")).toBeInTheDocument();
  });

  it("splits the table into the bank sheet and the system sheet", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);

    const banco = await screen.findByRole("columnheader", { name: /Extrato do banco/ });
    // data, descrição e valor do banco ficam na mesma folha
    expect(banco).toHaveAttribute("colspan", "3");
    expect(banco.querySelector('[data-origem="banco"]')).not.toBeNull();
    const sistema = screen.getByRole("columnheader", { name: /Sistema de gestão/ });
    expect(sistema.querySelector('[data-origem="sistema"]')).not.toBeNull();
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

  it("shows a skeleton while the backend has not answered yet", () => {
    // id em formato UUID: é o que faz a tela buscar no backend em vez do mock,
    // e é o único caminho em que existe uma espera de verdade para mostrar
    rota.id = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
    carregarConciliacao.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ConciliacaoPage />);
    expect(container.querySelector("[aria-busy=\"true\"]")).not.toBeNull();
  });

  it("offers a reload instead of an endless skeleton when the backend call throws", async () => {
    // a Server Action lançou (rede, deploy novo no meio) em vez de devolver um Resultado
    rota.id = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
    carregarConciliacao.mockRejectedValue(new Error("Failed to fetch"));
    const { container } = render(<ConciliacaoPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a conciliação. Recarregue a página e tente de novo.",
    );
    expect(container.querySelector("[aria-busy=\"true\"]")).toBeNull();
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
      linhas: conciliacaoMista.linhas.filter((linha) => linha.status === "match_exato"),
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

  it("switches the table density and remembers it", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoMista);
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    const compacta = await screen.findByRole("button", { name: "Compacta" });
    expect(screen.getByRole("button", { name: "Padrão" })).toHaveAttribute("aria-pressed", "true");

    await user.click(compacta);

    expect(compacta).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.densidade).toBe("compacta");
    expect(window.localStorage.getItem("ledgr_densidade")).toBe("compacta");
  });

  it("paginates past the page size and keeps the count honest", async () => {
    const muitas = Array.from({ length: 30 }, (_, i) => ({
      id: `l-${i}`,
      descricao: `Lançamento ${i}`,
      data: "04/09",
      valorBanco: 100 + i,
      valorSistema: 100 + i,
      status: "match_exato" as const,
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

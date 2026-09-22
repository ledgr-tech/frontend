import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Conciliacao } from "@/lib/mock-data";
import DetalheDivergenciaPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "conc-1", linha: "lc-2" }),
  useRouter: () => ({ push }),
}));

const buscarConciliacao = vi.fn();
const aceitarValorDoBanco = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  buscarConciliacao: (id: string) => buscarConciliacao(id),
  aceitarValorDoBanco: (id: string, linha: string) => aceitarValorDoBanco(id, linha),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

const conciliacao: Conciliacao = {
  id: "conc-1",
  mes: "Setembro 2026",
  status: "em_andamento",
  linhas: [
    {
      id: "lc-1",
      descricao: "Pagamento Vale Verde",
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
      explicacao: "O boleto foi emitido em R$ 12.604,00 e pago com acréscimo de R$ 36,00.",
      causa: "Juros de dois dias de atraso não lançados no sistema.",
      historico: [
        { quando: "28/08/2026", evento: "Título emitido", origem: "Sistema" },
        { quando: "04/09/2026", evento: "Boleto liquidado", origem: "Banco" },
      ],
      camposBanco: [{ rotulo: "Documento", valor: "00071.4482-9" }],
      camposSistema: [{ rotulo: "Conta contábil", valor: "2.01.01 Fornecedores" }],
      cronico: [
        { mes: "Julho", valorBanco: 11402, valorSistema: 11380, nota: "1 dia de atraso" },
        { mes: "Agosto", valorBanco: 11905, valorSistema: 11870, nota: "2 dias de atraso" },
      ],
    },
    {
      id: "lc-3",
      descricao: "TED sem par",
      data: "08/09",
      valorBanco: 3150,
      valorSistema: null,
      status: "somente_banco",
      explicacao: null,
      historico: [],
    },
  ],
};

describe("DetalheDivergenciaPage", () => {
  beforeEach(() => {
    buscarConciliacao.mockReset();
    aceitarValorDoBanco.mockReset();
    push.mockReset();
  });

  it("shows the two extratos side by side with the delta between them", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    render(<DetalheDivergenciaPage />);

    expect(await screen.findByText("Boleto Aço Norte Bobinas")).toBeInTheDocument();
    expect(screen.getByText("Extrato do banco")).toBeInTheDocument();
    expect(screen.getByText("Fonte da verdade")).toBeInTheDocument();
    expect(screen.getByText("R$ 12.640,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 12.604,00")).toBeInTheDocument();
    expect(screen.getByText("Δ 36,00")).toBeInTheDocument();
  });

  it("numbers the item among the linhas still em aberto, not among all of them", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    render(<DetalheDivergenciaPage />);
    // lc-2 é a primeira das duas em aberto; lc-1 já está batida e não conta
    expect(await screen.findByText(/item 01 de 2/)).toBeInTheDocument();
  });

  it("shows the causa above the long explanation", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    render(<DetalheDivergenciaPage />);

    expect(await screen.findByText("O que provavelmente aconteceu")).toBeInTheDocument();
    expect(
      screen.getByText("Juros de dois dias de atraso não lançados no sistema."),
    ).toBeInTheDocument();
  });

  it("shows the chronic block with the difference computed per month", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    render(<DetalheDivergenciaPage />);

    expect(await screen.findByText("Crônico, não pontual")).toBeInTheDocument();
    expect(screen.getByText("O mesmo fornecedor divergiu nos 2 últimos meses.")).toBeInTheDocument();
    expect(screen.getByText(/diferença de R\$ 22,00 · 1 dia de atraso/)).toBeInTheDocument();
    expect(screen.getByText(/diferença de R\$ 35,00 · 2 dias de atraso/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar regra para este fornecedor" })).toHaveAttribute(
      "href",
      "/regras",
    );
  });

  it("lists the lançamento history with its origem", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    render(<DetalheDivergenciaPage />);

    expect(await screen.findByText("Histórico do lançamento")).toBeInTheDocument();
    expect(screen.getByText("Título emitido")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });

  it("accepts the bank value and returns to the conciliação", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    const user = userEvent.setup();
    render(<DetalheDivergenciaPage />);

    await user.click(await screen.findByRole("button", { name: "Aceitar valor do banco" }));

    expect(aceitarValorDoBanco).toHaveBeenCalledWith("conc-1", "lc-2");
    expect(push).toHaveBeenCalledWith("/conciliacoes/conc-1");
  });

  it("shows a not found message when the linha does not belong to the conciliação", async () => {
    buscarConciliacao.mockReturnValue({ ...conciliacao, linhas: [] });
    render(<DetalheDivergenciaPage />);
    expect(await screen.findByText("Lançamento não encontrado.")).toBeInTheDocument();
  });

  it("shows a not found message when the conciliação does not exist", async () => {
    buscarConciliacao.mockReturnValue(null);
    render(<DetalheDivergenciaPage />);
    expect(await screen.findByText("Lançamento não encontrado.")).toBeInTheDocument();
  });
});

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
const restaurarLinha = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  buscarConciliacao: (id: string) => buscarConciliacao(id),
  aceitarValorDoBanco: (id: string, linha: string) => aceitarValorDoBanco(id, linha),
  restaurarLinha: (id: string, linha: unknown) => restaurarLinha(id, linha),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

/** A conciliação como fica depois de aceitar o valor do banco em lc-2. */
function comLc2Aceita(base: Conciliacao): Conciliacao {
  return {
    ...base,
    linhas: base.linhas.map((linha) =>
      linha.id === "lc-2" ? { ...linha, valorSistema: 12640, status: "batido" as const } : linha,
    ),
  };
}

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
    restaurarLinha.mockReset();
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

  it("collapses the history by default and leaves the chronic pattern open", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    const { container } = render(<DetalheDivergenciaPage />);

    await screen.findByText("Crônico, não pontual");
    const blocos = [...container.querySelectorAll("details")];
    const cronico = blocos.find((b) => b.textContent?.includes("Crônico"));
    const historico = blocos.find((b) => b.textContent?.includes("Histórico do lançamento"));

    // o padrão crônico muda o que você faz a seguir; procedência é consulta
    expect(cronico?.open).toBe(true);
    expect(historico?.open).toBe(false);
  });

  it("lists the lançamento history with its origem", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    render(<DetalheDivergenciaPage />);

    expect(await screen.findByText("Histórico do lançamento")).toBeInTheDocument();
    expect(screen.getByText("Título emitido")).toBeInTheDocument();
    expect(screen.getByText("Sistema")).toBeInTheDocument();
  });

  it("accepts the bank value in place, without navigating away", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    aceitarValorDoBanco.mockReturnValue(comLc2Aceita(conciliacao));
    const user = userEvent.setup();
    render(<DetalheDivergenciaPage />);

    await user.click(await screen.findByRole("button", { name: "Aceitar valor do banco" }));

    expect(aceitarValorDoBanco).toHaveBeenCalledWith("conc-1", "lc-2");
    // a decisão acontece aqui: sair da tela tiraria o desfazer de alcance
    expect(push).not.toHaveBeenCalled();
    // e a consequência aparece
    expect(screen.getByText("Conciliado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar valor do banco" })).not.toBeInTheDocument();
  });

  it("offers an undo after accepting", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    aceitarValorDoBanco.mockReturnValue(comLc2Aceita(conciliacao));
    const user = userEvent.setup();
    render(<DetalheDivergenciaPage />);

    await user.click(await screen.findByRole("button", { name: "Aceitar valor do banco" }));

    expect(screen.getByRole("status")).toHaveTextContent(/Valor do banco aceito/);
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeInTheDocument();
  });

  it("puts the linha back when the undo is used", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    aceitarValorDoBanco.mockReturnValue(comLc2Aceita(conciliacao));
    restaurarLinha.mockReturnValue(conciliacao);
    const user = userEvent.setup();
    render(<DetalheDivergenciaPage />);

    await user.click(await screen.findByRole("button", { name: "Aceitar valor do banco" }));
    await user.click(screen.getByRole("button", { name: "Desfazer" }));

    // recebe o retrato da linha como ela estava, não um id solto
    expect(restaurarLinha).toHaveBeenCalledWith(
      "conc-1",
      expect.objectContaining({ id: "lc-2", status: "divergencia_valor", valorSistema: 12604 }),
    );
    expect(screen.getByRole("button", { name: "Aceitar valor do banco" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
  });

  it("dismisses the undo bar without reverting", async () => {
    buscarConciliacao.mockReturnValue(conciliacao);
    aceitarValorDoBanco.mockReturnValue(comLc2Aceita(conciliacao));
    const user = userEvent.setup();
    render(<DetalheDivergenciaPage />);

    await user.click(await screen.findByRole("button", { name: "Aceitar valor do banco" }));
    await user.click(screen.getByRole("button", { name: "Pronto" }));

    expect(restaurarLinha).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
    expect(screen.getByText("Conciliado")).toBeInTheDocument();
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

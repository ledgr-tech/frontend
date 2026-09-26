import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Conciliacao } from "@/lib/mock-data";
import ConciliacaoPage from "./page";

// hoisted porque a fábrica do vi.mock roda antes das declarações do módulo
const rota = vi.hoisted(() => ({ id: "conc-1", busca: "" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: rota.id }),
  useSearchParams: () => new URLSearchParams(rota.busca),
  useRouter: () => ({ push: vi.fn() }),
}));

const carregarConciliacao = vi.fn();
vi.mock("../acoes", () => ({
  carregarConciliacao: (...args: unknown[]) => carregarConciliacao(...args),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

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
    rota.busca = "";
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
    expect(screen.getByRole("button", { name: "Boleto Aço Norte Bobinas" })).toBeInTheDocument();
  });

  it("splits the table into the bank sheet and the system sheet", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);

    const banco = await screen.findByRole("columnheader", { name: /Extrato do banco/ });
    // data, descrição e valor do banco ficam na mesma folha
    expect(banco).toHaveAttribute("colspan", "3");
    expect(banco.querySelector('[data-origem="banco"]')).not.toBeNull();
    const sistema = screen.getByRole("columnheader", { name: /Sistema de gestão/ });
    // e a do sistema também: o mesmo lançamento pode ter outro dia e outro nome no ERP
    expect(sistema).toHaveAttribute("colspan", "3");
    expect(sistema.querySelector('[data-origem="sistema"]')).not.toBeNull();
  });

  it("shows the system's own date and description next to the bank's", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoEmAndamento,
      linhas: [
        {
          ...conciliacaoEmAndamento.linhas[0],
          status: "match_tolerancia",
          dataSistema: "05/09",
          descricaoSistema: "Pagamento fornecedor Aço Norte",
        },
      ],
    });
    render(<ConciliacaoPage />);

    const linha = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr")!;
    const celulas = within(linha).getAllByRole("cell");
    // o Intl separa "R$" do valor com espaço não separável
    expect(celulas.map((celula) => celula.textContent?.replace(/\s/g, " "))).toEqual([
      "04/09",
      "Boleto Aço Norte Bobinas",
      "R$ 12.640,00",
      "05/09",
      "Pagamento fornecedor Aço Norte",
      "R$ 12.604,00",
      "Match por tolerância de data",
    ]);
  });

  it("leaves the bank sheet empty when only the system has the lançamento, and opens it from there", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoEmAndamento,
      linhas: [
        {
          ...conciliacaoEmAndamento.linhas[0],
          valorBanco: null,
          status: "sem_correspondencia",
          dataSistema: "04/09",
          descricaoSistema: "Boleto Aço Norte Bobinas",
        },
      ],
    });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    const linha = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr")!;
    const [data, descricao, valor] = within(linha).getAllByRole("cell");
    expect([data.textContent, descricao.textContent, valor.textContent]).toEqual(["—", "—", "—"]);

    await user.click(within(linha).getByRole("button", { name: "Boleto Aço Norte Bobinas" }));
    expect(screen.getByRole("link", { name: "Abrir detalhe" })).toBeInTheDocument();
  });

  describe("the lançamento card on hover", () => {
    beforeEach(() => {
      vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: consulta === "(hover: hover)" }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("shows both sides and the explanation of a line under review, like the landing", async () => {
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      const linha = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr")!;
      await user.hover(linha);

      const cartao = screen.getByRole("tooltip");
      expect(cartao).toHaveTextContent("Lançamento · Valor diverge na mesma data");
      expect(within(cartao).getByText("Extrato do banco").nextSibling).toHaveTextContent("04/09 · R$ 12.640,00");
      expect(within(cartao).getByText("Extrato do sistema").nextSibling).toHaveTextContent("04/09 · R$ 12.604,00");
      expect(cartao).toHaveTextContent("Juros de dois dias de atraso não lançados no sistema.");
      expect(within(linha).getByRole("button")).toHaveAccessibleDescription(/Valor diverge na mesma data/);

      await user.unhover(linha);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("stays quiet on lines that already matched", async () => {
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      await user.hover((await screen.findByRole("button", { name: "Pagamento batido" })).closest("tr")!);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("opens for the keyboard too, and Escape closes it", async () => {
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      const user = userEvent.setup();
      render(<ConciliacaoPage />);
      const botao = await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" });

      act(() => botao.focus());
      expect(screen.getByRole("tooltip")).toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("gives way to the dialog when the line is clicked", async () => {
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      await user.click(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" }));
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Abrir detalhe" })).toBeInTheDocument();
    });
  });

  it("tags each row with the tone of its status, which colors the hover", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);

    const linha = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr");
    // valor diverge na mesma data: terracota, a cor de quem custa dinheiro
    expect(linha).toHaveAttribute("data-tom", "risco");
  });

  it("opens the transaction dialog with its explanation when a row is clicked", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    await user.click(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" }));
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

  it("loads only the lines of the pair named in the URL, and keeps it in the link to a line", async () => {
    rota.id = BANCO;
    rota.busca = `sistema=${SISTEMA}`;
    carregarConciliacao.mockResolvedValue({
      ok: true,
      dados: {
        conciliacao: { ...conciliacaoEmAndamento, id: BANCO, extratoSistemaId: SISTEMA },
        truncada: false,
      },
    });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    await user.click(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" }));

    expect(carregarConciliacao).toHaveBeenCalledWith(BANCO, SISTEMA);
    expect(screen.getByRole("link", { name: "Abrir detalhe" })).toHaveAttribute(
      "href",
      `/conciliacoes/${BANCO}/lc-1?sistema=${SISTEMA}`,
    );
  });

  it("offers the CSV of the pair only for a conciliação from the backend", async () => {
    rota.id = BANCO;
    rota.busca = `sistema=${SISTEMA}`;
    carregarConciliacao.mockResolvedValue({
      ok: true,
      dados: {
        conciliacao: { ...conciliacaoMista, id: BANCO, extratoSistemaId: SISTEMA },
        truncada: false,
      },
    });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    expect(await screen.findByRole("button", { name: "Exportar CSV" })).toBeInTheDocument();
    // o backend filtra um status por vez; o "Só revisão" junta cinco, e o
    // arquivo sai com tudo — o botão não pode deixar entender outra coisa
    await user.click(screen.getByRole("button", { name: "Só revisão (1)" }));
    expect(screen.getByRole("button", { name: "Exportar CSV (todas as linhas)" })).toBeInTheDocument();
  });

  it("has no CSV for the mock conciliação, which the backend does not know", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);

    expect(await screen.findByText("Comparação direta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });

  it("treats an empty pair in the URL as no pair at all", async () => {
    rota.id = BANCO;
    rota.busca = "sistema=";
    carregarConciliacao.mockResolvedValue({
      ok: true,
      dados: { conciliacao: { ...conciliacaoEmAndamento, id: BANCO }, truncada: false },
    });
    render(<ConciliacaoPage />);

    expect(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).toBeInTheDocument();
    expect(carregarConciliacao).toHaveBeenCalledWith(BANCO, undefined);
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

    expect(await screen.findByRole("button", { name: "Pagamento batido" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Só revisão (1)" }));

    expect(screen.queryByRole("button", { name: "Pagamento batido" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Boleto Aço Norte Bobinas" })).toBeInTheDocument();
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

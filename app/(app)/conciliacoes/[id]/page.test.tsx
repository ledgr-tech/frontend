import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Conciliacao, Decisao } from "@/lib/mock-data";
import ConciliacaoPage from "./page";

// hoisted porque a fábrica do vi.mock roda antes das declarações do módulo
const rota = vi.hoisted(() => ({ id: "conc-1", busca: "" }));
const navegar = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: rota.id }),
  useSearchParams: () => new URLSearchParams(rota.busca),
  useRouter: () => ({ push: navegar.push }),
}));

const carregarConciliacao = vi.fn();
const registrarDecisao = vi.fn();
vi.mock("../acoes", () => ({
  carregarConciliacao: (...args: unknown[]) => carregarConciliacao(...args),
  // a tela carrega pela rodada; aqui ela embrulha a carga de sempre, sem rodada
  carregarConciliacaoEmRodadas: async (...args: unknown[]) => {
    const resposta = await carregarConciliacao(...args);
    return resposta.ok ? { ...resposta, dados: { rodada: null, mudancas: null, ...resposta.dados } } : resposta;
  },
  registrarDecisao: (...args: unknown[]) => registrarDecisao(...args),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

const buscarConciliacao = vi.fn();
const fecharConciliacao = vi.fn();
const registrarDecisaoNoMock = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  buscarConciliacao: (id: string) => buscarConciliacao(id),
  fecharConciliacao: (id: string) => fecharConciliacao(id),
  registrarDecisaoNoMock: (...args: unknown[]) => registrarDecisaoNoMock(...args),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

function decisao(tipo: Decisao["tipo"], rodada = 1): Decisao {
  return {
    tipo,
    texto: tipo === "justificada" ? "Juros de dois dias de atraso." : null,
    autor: "Eduardo Sichelero",
    em: "2026-09-30T13:12:00Z",
    rodada,
  };
}

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

// uma conciliação do backend com três categorias em revisão, para o relatório
const conciliacaoDoRelatorio: Conciliacao = {
  ...conciliacaoMista,
  id: BANCO,
  extratoSistemaId: SISTEMA,
  linhas: [
    ...conciliacaoMista.linhas,
    {
      id: "lc-3",
      descricao: "Tarifa pacote de serviços",
      data: "05/09",
      valorBanco: -89.9,
      valorSistema: null,
      status: "tarifa_bancaria",
      explicacao: null,
      historico: [],
    },
    {
      id: "lc-4",
      descricao: "Tarifa TED",
      data: "06/09",
      valorBanco: -12.5,
      valorSistema: null,
      status: "tarifa_bancaria",
      explicacao: null,
      historico: [],
    },
  ],
};

describe("ConciliacaoPage", () => {
  beforeEach(() => {
    rota.id = "conc-1";
    rota.busca = "";
    // a categoria escolhida vai para a URL de verdade; cada teste começa sem ela
    window.history.replaceState(null, "", "/");
    buscarConciliacao.mockReset();
    fecharConciliacao.mockReset();
    carregarConciliacao.mockReset();
    registrarDecisao.mockReset();
    registrarDecisaoNoMock.mockReset();
    navegar.push.mockReset();
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
    const textos = celulas.map((celula) => celula.textContent?.replace(/\s/g, " "));
    expect(textos.slice(0, 3)).toEqual(["04/09", "Boleto Aço Norte Bobinas", "R$ 12.640,00"]);
    expect(textos.slice(4)).toEqual(["05/09", "Pagamento fornecedor Aço Norte", "R$ 12.604,00"]);
  });

  it("puts the status between the two sheets, as the verdict on the pair", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);

    await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" });
    const [, colunas, linha] = screen.getAllByRole("row");
    // a seta diz quem ordena: a data, de saída
    expect(within(colunas).getAllByRole("columnheader").map((coluna) => coluna.textContent)).toEqual([
      "Data▲",
      "Descrição↕",
      "Banco↕",
      "Status↕",
      "Data",
      "Descrição",
      "Sistema↕",
    ]);
    expect(within(linha).getAllByRole("cell")[3]).toHaveAttribute("data-rotulo", "Status");
  });

  it("names the status in a few words, and keeps the full name for screen readers", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoMista);
    render(<ConciliacaoPage />);

    const divergente = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr")!;
    const status = within(divergente).getAllByRole("cell")[3];
    const curto = within(status).getByText("Valor diverge");
    expect(curto).toHaveClass("selo", "selo-risco");
    expect(curto).toHaveAttribute("aria-hidden", "true");
    expect(within(status).getByText("Valor diverge na mesma data")).toHaveClass("sr-only");

    // o que bateu fica quieto: o nome sem selo, para o olho ir direto ao que pede revisão
    const batida = screen.getByRole("button", { name: "Pagamento batido" }).closest("tr")!;
    expect(within(batida).getByText("Bate")).not.toHaveClass("selo");
  });

  it("marks the field that diverges: the values when the value differs, the dates when the date does", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoMista,
      linhas: [
        conciliacaoMista.linhas[1],
        {
          id: "lc-3",
          descricao: "DAS Simples Nacional",
          data: "25/09",
          dataSistema: "20/09",
          valorBanco: -1320,
          valorSistema: -1320,
          status: "divergente_data",
          explicacao: null,
          historico: [],
        },
      ],
    });
    render(<ConciliacaoPage />);

    const diverge = (celula: HTMLElement) => celula.hasAttribute("data-diverge");
    const valor = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr")!;
    // data, descrição, valor | status | data, descrição, valor
    expect(within(valor).getAllByRole("cell").map(diverge)).toEqual([
      false, false, true, false, false, false, true,
    ]);
    const data = screen.getByRole("button", { name: "DAS Simples Nacional" }).closest("tr")!;
    expect(within(data).getAllByRole("cell").map(diverge)).toEqual([
      true, false, false, false, true, false, false,
    ]);
    // o texto do campo vai numa marca, que acende de leve quando o ponteiro está na linha
    expect(within(valor).getByText(/12\.640,00/)).toHaveClass("marca-diverge");
    expect(within(data).getByText("20/09")).toHaveClass("marca-diverge");
  });

  it("gives the full description on hover where the table cuts it to one line, unless the card already does", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoMista,
      linhas: [
        {
          ...conciliacaoMista.linhas[0],
          descricao: "PIX RECEBIDO - CONSTRUTORA ALVO EMPREENDIMENTOS IMOBILIARIOS LTDA",
          descricaoSistema: "Recebimento NF 4521 - Construtora Alvo Empreendimentos Imobiliários Ltda",
        },
        conciliacaoMista.linhas[1],
      ],
    });
    render(<ConciliacaoPage />);

    const batida = (await screen.findByRole("button", { name: /^PIX RECEBIDO/ })).closest("tr")!;
    const [, banco, , , , sistema] = within(batida).getAllByRole("cell");
    expect(banco).toHaveAttribute("title", "PIX RECEBIDO - CONSTRUTORA ALVO EMPREENDIMENTOS IMOBILIARIOS LTDA");
    expect(sistema).toHaveAttribute(
      "title",
      "Recebimento NF 4521 - Construtora Alvo Empreendimentos Imobiliários Ltda",
    );
    // a linha em revisão abre o cartão, que mostra as duas descrições inteiras: sem dica dupla
    const divergente = screen.getByRole("button", { name: "Boleto Aço Norte Bobinas" }).closest("tr")!;
    expect(within(divergente).getAllByRole("cell")[1]).not.toHaveAttribute("title");
  });

  it("widens the value column for a conciliação with values past the millions", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoMista,
      linhas: [...conciliacaoMista.linhas, { ...conciliacaoMista.linhas[0], id: "lc-9", valorBanco: -12345678.9 }],
    });
    const { container } = render(<ConciliacaoPage />);

    await screen.findByText("Comparação direta");
    const tabela = container.querySelector("table")!;
    expect(tabela.style.getPropertyValue("--valor-largura")).toBe("11.28rem");
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
    // uma célula só no lugar de três traços: a folha diz que falta, não que está em branco
    const [vazia, status] = within(linha).getAllByRole("cell");
    expect(vazia).toHaveTextContent("sem lançamento no banco");
    expect(vazia).toHaveAttribute("colspan", "3");
    expect(status).toHaveTextContent("Falta no banco");

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
      expect(within(linha).getByRole("button", { name: "Boleto Aço Norte Bobinas" })).toHaveAccessibleDescription(
        /Valor diverge na mesma data/,
      );

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

  it("peeks at a line in a native dialog, without an empty history, and gives the focus back", async () => {
    buscarConciliacao.mockReturnValue({
      ...conciliacaoEmAndamento,
      linhas: [{ ...conciliacaoEmAndamento.linhas[0], historico: [] }],
    });
    const user = userEvent.setup();
    render(<ConciliacaoPage />);

    const linha = await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" });
    await user.click(linha);

    const espia = screen.getByRole("dialog", { name: "Boleto Aço Norte Bobinas" });
    expect(espia.tagName).toBe("DIALOG");
    // o backend não registra eventos: sem evento, sem tabela "Quando / Evento" vazia
    expect(within(espia).queryByRole("columnheader", { name: "Quando" })).not.toBeInTheDocument();

    await user.click(within(espia).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(linha).toHaveFocus();

    // o Esc fecha na hora, e a mesma linha abre de novo
    await user.click(linha);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(linha);
    expect(screen.getByRole("dialog", { name: "Boleto Aço Norte Bobinas" })).toHaveAttribute("open");
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

  it("has no CSV export in the header, not even for a conciliação from the backend", async () => {
    rota.id = BANCO;
    rota.busca = `sistema=${SISTEMA}`;
    carregarConciliacao.mockResolvedValue({
      ok: true,
      dados: {
        conciliacao: { ...conciliacaoMista, id: BANCO, extratoSistemaId: SISTEMA },
        truncada: false,
      },
    });
    render(<ConciliacaoPage />);

    // espera a conciliação do backend chegar: antes dela o cabeçalho não tem o que exportar
    expect(await screen.findByRole("button", { name: "Só revisão (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });

  it("has no CSV for the mock conciliação, which the backend does not know", async () => {
    buscarConciliacao.mockReturnValue(conciliacaoEmAndamento);
    render(<ConciliacaoPage />);

    expect(await screen.findByText("Comparação direta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exportar CSV/ })).not.toBeInTheDocument();
  });

  describe("the rounds of a conciliação", () => {
    const RODADA_2 = {
      numero: 2,
      total: 2,
      extratoSistemaId: SISTEMA,
      arquivoSistema: "erp-setembro-v2.csv",
      executadaEm: "2026-09-24T17:02:00Z",
    };

    function doBackend(extra: Record<string, unknown>) {
      rota.id = BANCO;
      carregarConciliacao.mockResolvedValue({
        ok: true,
        dados: {
          conciliacao: { ...conciliacaoMista, id: BANCO, extratoSistemaId: SISTEMA },
          truncada: false,
          ...extra,
        },
      });
    }

    it("says the round in the context line when there is more than one", async () => {
      doBackend({ rodada: RODADA_2 });
      const { unmount } = render(<ConciliacaoPage />);
      expect(await screen.findByText(/rodada 2 · erp-setembro-v2\.csv, 24\/09\/2026 14:02/)).toBeInTheDocument();
      unmount();

      doBackend({ rodada: { ...RODADA_2, numero: 1, total: 1 } });
      render(<ConciliacaoPage />);
      await screen.findByText("Comparação direta");
      expect(screen.queryByText(/rodada/)).not.toBeInTheDocument();
    });

    it("warns about an old round and leads to the latest", async () => {
      doBackend({ rodada: { ...RODADA_2, numero: 1 } });
      render(<ConciliacaoPage />);

      const aviso = await screen.findByText(/Rodada 1 de 2/);
      expect(aviso.closest("[role=status]")).not.toBeNull();
      expect(screen.getByRole("link", { name: "ver a mais recente" })).toHaveAttribute("href", `/conciliacoes/${BANCO}`);
    });

    it("offers a new version of the system extrato only on the latest round of a real conciliação", async () => {
      const nome = "Enviar nova versão do extrato do sistema";
      doBackend({ rodada: RODADA_2 });
      const primeira = render(<ConciliacaoPage />);
      expect(await screen.findByRole("button", { name: nome })).toBeInTheDocument();
      primeira.unmount();

      // rodada passada é só para ler
      doBackend({ rodada: { ...RODADA_2, numero: 1 } });
      const antiga = render(<ConciliacaoPage />);
      await screen.findByText(/Rodada 1 de 2/);
      expect(screen.queryByRole("button", { name: nome })).not.toBeInTheDocument();
      antiga.unmount();

      // o mock não tem extrato para versionar
      rota.id = "conc-1";
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      render(<ConciliacaoPage />);
      await screen.findByText("Comparação direta");
      expect(screen.queryByRole("button", { name: nome })).not.toBeInTheDocument();
    });

    it("counts what changed since the previous round", async () => {
      doBackend({ rodada: RODADA_2, mudancas: { passaramABater: 4, continuamDivergindo: 2, novas: 1 } });
      const { unmount } = render(<ConciliacaoPage />);
      expect(
        await screen.findByText("Desde a rodada 1: 4 passaram a bater · 2 continuam divergindo · 1 nova divergência"),
      ).toBeInTheDocument();
      unmount();

      doBackend({ rodada: RODADA_2, mudancas: { passaramABater: 1, continuamDivergindo: 1, novas: 3 } });
      render(<ConciliacaoPage />);
      expect(
        await screen.findByText("Desde a rodada 1: 1 passou a bater · 1 continua divergindo · 3 novas divergências"),
      ).toBeInTheDocument();
    });
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

  describe("the report grouped by category", () => {
    it("counts the five categories, with the money each leaves open", async () => {
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      render(<ConciliacaoPage />);

      const relatorio = await screen.findByRole("region", { name: "Divergências por categoria" });
      const categorias = within(relatorio).getAllByRole("button");
      expect(categorias).toHaveLength(5);
      expect(categorias[0]).toHaveTextContent(/^Valor diverge na mesma data\s*1\s*R\$\s36 em aberto$/);
      expect(relatorio).toHaveTextContent(/1 linha pede revisão · R\$\s36 em aberto/);
      // sem linha, não há o que abrir; o zero fica, apagado
      expect(within(relatorio).getByRole("button", { name: /Possível duplicidade/ })).toBeDisabled();
    });

    it("drills into a category: the table, the URL and the CSV follow it", async () => {
      rota.id = BANCO;
      rota.busca = `sistema=${SISTEMA}`;
      window.history.replaceState(null, "", `/conciliacoes/${BANCO}?sistema=${SISTEMA}`);
      carregarConciliacao.mockResolvedValue({
        ok: true,
        dados: { conciliacao: conciliacaoDoRelatorio, truncada: false },
      });
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      const tarifas = await screen.findByRole("button", { name: /Tarifa bancária/ });
      await user.click(tarifas);

      expect(tarifas).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Tarifa TED" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Boleto Aço Norte Bobinas" })).not.toBeInTheDocument();
      expect(window.location.search).toBe(`?sistema=${SISTEMA}&status=tarifa_bancaria`);

      // desligar volta ao que as cinco juntam
      await user.click(tarifas);
      expect(screen.getByRole("button", { name: "Só revisão (3)" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("button", { name: "Boleto Aço Norte Bobinas" })).toBeInTheDocument();
      expect(window.location.search).toBe(`?sistema=${SISTEMA}`);
    });

    it("opens on the category named in the URL, and ignores one that is not a divergence", async () => {
      rota.id = BANCO;
      rota.busca = `sistema=${SISTEMA}&status=divergente_valor`;
      carregarConciliacao.mockResolvedValue({
        ok: true,
        dados: { conciliacao: conciliacaoDoRelatorio, truncada: false },
      });
      const { unmount } = render(<ConciliacaoPage />);

      expect(await screen.findByRole("button", { name: /Valor diverge na mesma data/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.queryByRole("button", { name: "Tarifa TED" })).not.toBeInTheDocument();
      unmount();

      rota.busca = `sistema=${SISTEMA}&status=duplicado`;
      const segunda = render(<ConciliacaoPage />);
      expect(await screen.findByText("Nenhuma linha em “Possível duplicidade” nesta conciliação.")).toBeInTheDocument();
      segunda.unmount();

      rota.busca = `sistema=${SISTEMA}&status=match_exato`;
      render(<ConciliacaoPage />);
      expect(await screen.findByRole("button", { name: "Todos (4)" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("checked and justified lines", () => {
    // do mock, onde as decisões ficam em memória: uma batida, uma justificada,
    // uma conferida e uma que ninguém olhou
    const comDecisoes: Conciliacao = {
      ...conciliacaoMista,
      linhas: [
        conciliacaoMista.linhas[0],
        { ...conciliacaoMista.linhas[1], decisao: decisao("justificada") },
        { ...conciliacaoDoRelatorio.linhas[2], decisao: decisao("conferida") },
        { ...conciliacaoDoRelatorio.linhas[3], decisao: null },
      ],
    };

    // do backend que guarda decisões: o campo vem em todos os itens, mesmo vazio
    const comCampo: Conciliacao = {
      ...conciliacaoDoRelatorio,
      linhas: conciliacaoDoRelatorio.linhas.map((linha) => ({ ...linha, chave: `b:${linha.id}`, decisao: null })),
    };

    const RODADA_2 = {
      numero: 2,
      total: 2,
      extratoSistemaId: SISTEMA,
      arquivoSistema: "erp-setembro-v2.csv",
      executadaEm: "2026-09-24T17:02:00Z",
    };

    function doBackend(conciliacao: Conciliacao, extra: Record<string, unknown> = {}) {
      rota.id = BANCO;
      carregarConciliacao.mockResolvedValue({
        ok: true,
        dados: { conciliacao: { ...conciliacao, id: BANCO, extratoSistemaId: SISTEMA }, truncada: false, ...extra },
      });
    }

    it("keeps the justified lines out of what needs review, and counts them apart", async () => {
      buscarConciliacao.mockReturnValue(comDecisoes);
      render(<ConciliacaoPage />);

      const relatorio = await screen.findByRole("region", { name: "Divergências por categoria" });
      expect(relatorio).toHaveTextContent(/2 linhas pedem revisão · R\$\s102 em aberto · 1 justificada/);
      // a justificada sai da categoria dela: o contador anda junto com o filtro
      expect(within(relatorio).getByRole("button", { name: /Valor diverge na mesma data/ })).toHaveTextContent(
        /^Valor diverge na mesma data\s*0\s*Sem valor em aberto$/,
      );
      expect(screen.getByRole("button", { name: "Todos (4)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Só revisão (2)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Justificadas (1)" })).toBeInTheDocument();
      expect(screen.getByText("1 de 2 conferidas")).toBeInTheDocument();
    });

    it("filters down to the justified lines, and out of them in review", async () => {
      buscarConciliacao.mockReturnValue(comDecisoes);
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      await user.click(await screen.findByRole("button", { name: "Justificadas (1)" }));
      expect(screen.getByRole("button", { name: "Boleto Aço Norte Bobinas" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Tarifa TED" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Só revisão (2)" }));
      expect(screen.queryByRole("button", { name: "Boleto Aço Norte Bobinas" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tarifa pacote de serviços" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Tarifa TED" })).toBeInTheDocument();
    });

    it("filters as before when the backend does not keep decisions, and turns on when it sends the field", async () => {
      doBackend(conciliacaoMista);
      const { unmount } = render(<ConciliacaoPage />);
      expect(await screen.findByRole("button", { name: "Só revisão (1)" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Justificadas/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/de \d+ conferidas?$/)).not.toBeInTheDocument();
      // sem onde gravar, a tela não oferece marcar
      expect(screen.queryByRole("button", { name: /como conferida$/ })).not.toBeInTheDocument();
      unmount();

      // o campo vem mesmo vazio quando o backend guarda decisões
      doBackend({ ...conciliacaoMista, linhas: conciliacaoMista.linhas.map((linha) => ({ ...linha, decisao: null })) });
      render(<ConciliacaoPage />);
      expect(await screen.findByRole("button", { name: "Justificadas (0)" })).toBeInTheDocument();
      expect(screen.getByText("0 de 1 conferida")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Marcar Boleto Aço Norte Bobinas como conferida" })).toBeInTheDocument();
    });

    it("does not count a check from an earlier round when the line still diverges", async () => {
      doBackend({
        ...conciliacaoDoRelatorio,
        rodada: 2,
        linhas: [
          { ...conciliacaoDoRelatorio.linhas[2], decisao: decisao("conferida", 1) },
          { ...conciliacaoDoRelatorio.linhas[3], decisao: null },
        ],
      });
      render(<ConciliacaoPage />);

      expect(await screen.findByText("0 de 2 conferidas")).toBeInTheDocument();
    });

    it("explains an empty justified filter, and a review list emptied by justifications", async () => {
      buscarConciliacao.mockReturnValue(conciliacaoMista);
      const user = userEvent.setup();
      const { unmount } = render(<ConciliacaoPage />);
      await user.click(await screen.findByRole("button", { name: "Justificadas (0)" }));
      expect(screen.getByText("Nenhuma linha justificada nesta conciliação.")).toBeInTheDocument();
      unmount();

      buscarConciliacao.mockReturnValue({
        ...conciliacaoMista,
        linhas: [conciliacaoMista.linhas[0], { ...conciliacaoMista.linhas[1], decisao: decisao("justificada") }],
      });
      render(<ConciliacaoPage />);
      await user.click(await screen.findByRole("button", { name: "Só revisão (0)" }));
      // não bateu tudo: o que sobrou está justificado
      expect(screen.getByText("Nada em revisão nesta competência: o que não bateu está justificado.")).toBeInTheDocument();
      // sem nada a conferir, "0 de 0 conferidas" não diz nada
      expect(screen.queryByText(/de \d+ conferidas?$/)).not.toBeInTheDocument();
    });

    it("checks a line on the axis and unchecks it, kept by the mock", async () => {
      // o mock de verdade, guardado no navegador como o "Fechar mês"
      const real = await vi.importActual<typeof import("@/lib/mock-data")>("@/lib/mock-data");
      buscarConciliacao.mockImplementation(real.buscarConciliacao);
      registrarDecisaoNoMock.mockImplementation(real.registrarDecisaoNoMock);
      const criada = real.criarConciliacao();
      rota.id = criada.id;
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      const caixa = await screen.findByRole("button", { name: "Marcar Boleto Aço Norte Bobinas como conferida" });
      expect(caixa).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("0 de 3 conferidas")).toBeInTheDocument();

      await user.click(caixa);
      expect(caixa).toHaveAttribute("aria-pressed", "true");
      expect(caixa.closest("tr")).toHaveAttribute("data-situacao", "conferida");
      expect(screen.getByText("1 de 3 conferidas")).toBeInTheDocument();
      expect(real.buscarConciliacao(criada.id)?.linhas.find((linha) => linha.id === "lc-2")?.decisao?.tipo).toBe(
        "conferida",
      );

      await user.click(caixa);
      expect(caixa).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("0 de 3 conferidas")).toBeInTheDocument();
    });

    it("checks right away, and puts the box back with the reason when saving fails", async () => {
      doBackend(comCampo);
      let responder: (resposta: unknown) => void = () => {};
      registrarDecisao.mockReturnValue(new Promise((resolve) => (responder = resolve)));
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      const caixa = await screen.findByRole("button", { name: "Marcar Boleto Aço Norte Bobinas como conferida" });
      await user.click(caixa);
      // a decisão vai pela chave da linha, que é a mesma em todas as rodadas
      expect(registrarDecisao).toHaveBeenCalledWith(BANCO, "b:lc-2", "conferida", undefined);
      expect(caixa).toHaveAttribute("aria-pressed", "true");

      await act(async () => responder({ ok: false, status: 500, erro: "O servidor respondeu 500." }));
      expect(caixa).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("alert")).toHaveTextContent("O servidor respondeu 500.");
    });

    it("puts the box back when the call itself fails", async () => {
      doBackend(comCampo);
      // a Server Action lançou (rede caída, deploy novo no meio) em vez de devolver um Resultado
      registrarDecisao.mockRejectedValue(new Error("Failed to fetch"));
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      const caixa = await screen.findByRole("button", { name: "Marcar Tarifa TED como conferida" });
      await user.click(caixa);
      expect(caixa).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível falar com o servidor.");

      // e a linha não fica presa como se ainda estivesse gravando
      registrarDecisao.mockResolvedValue({ ok: true, dados: decisao("conferida") });
      await user.click(caixa);
      expect(caixa).toHaveAttribute("aria-pressed", "true");
    });

    it("sends an expired session to the login", async () => {
      doBackend(comCampo);
      registrarDecisao.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." });
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      await user.click(await screen.findByRole("button", { name: "Marcar Tarifa TED como conferida" }));
      expect(navegar.push).toHaveBeenCalledWith("/login");
    });

    it("reloads with a notice when another round came in meanwhile", async () => {
      doBackend(comCampo);
      registrarDecisao.mockResolvedValue({
        ok: false,
        status: 404,
        erro: "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.",
      });
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      await user.click(await screen.findByRole("button", { name: "Marcar Tarifa TED como conferida" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.",
      );
      expect(carregarConciliacao).toHaveBeenCalledTimes(2);
    });

    it("keeps a line checked meanwhile when an earlier answer arrives, and does not send twice", async () => {
      doBackend(comCampo);
      const respostas: ((resposta: unknown) => void)[] = [];
      registrarDecisao.mockImplementation(() => new Promise((resolve) => respostas.push(resolve)));
      const user = userEvent.setup();
      render(<ConciliacaoPage />);

      const boleto = await screen.findByRole("button", { name: "Marcar Boleto Aço Norte Bobinas como conferida" });
      const tarifa = screen.getByRole("button", { name: "Marcar Tarifa TED como conferida" });
      await user.click(boleto);
      // o segundo clique, ainda gravando o primeiro, não manda o contrário por cima
      await user.click(boleto);
      await user.click(tarifa);
      expect(registrarDecisao).toHaveBeenCalledTimes(2);

      await act(async () => respostas[0]({ ok: true, dados: decisao("conferida", 1) }));
      expect(boleto).toHaveAttribute("aria-pressed", "true");
      expect(tarifa).toHaveAttribute("aria-pressed", "true");

      await act(async () => respostas[1]({ ok: true, dados: decisao("conferida", 1) }));
      expect(screen.getByText("2 de 3 conferidas")).toBeInTheDocument();
    });

    it("offers no box on an old round, which is only for reading", async () => {
      doBackend(comCampo, { rodada: { ...RODADA_2, numero: 1 } });
      render(<ConciliacaoPage />);

      await screen.findByText(/Rodada 1 de 2/);
      expect(screen.queryByRole("button", { name: /como conferida$/ })).not.toBeInTheDocument();
    });

    it("shows a justified line as Justificada on the axis, without a box", async () => {
      buscarConciliacao.mockReturnValue(comDecisoes);
      render(<ConciliacaoPage />);

      const linha = (await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" })).closest("tr")!;
      const status = within(linha).getAllByRole("cell")[3];
      expect(within(status).getByText("Justificada")).not.toHaveClass("selo-risco");
      expect(within(status).getByText("Valor diverge na mesma data · justificada")).toHaveClass("sr-only");
      expect(within(status).queryByRole("button")).not.toBeInTheDocument();
    });

    it("marks a line checked in an earlier round that still diverges, with the box empty again", async () => {
      doBackend(
        {
          ...comCampo,
          rodada: 2,
          linhas: comCampo.linhas.map((linha) =>
            linha.id === "lc-2" ? { ...linha, decisao: decisao("conferida", 1) } : linha,
          ),
        },
        { rodada: RODADA_2 },
      );
      render(<ConciliacaoPage />);

      const caixa = await screen.findByRole("button", { name: "Marcar Boleto Aço Norte Bobinas como conferida" });
      expect(caixa).toHaveAttribute("aria-pressed", "false");
      expect(
        within(caixa.closest("td")!).getByText("Conferida na rodada 1, continua divergindo depois da nova versão"),
      ).toHaveClass("sr-only");
    });

    describe("justifying in the line's window", () => {
      it("justifies with a text, and the axis says Justificada", async () => {
        // o mock de verdade, guardado no navegador
        const real = await vi.importActual<typeof import("@/lib/mock-data")>("@/lib/mock-data");
        buscarConciliacao.mockImplementation(real.buscarConciliacao);
        registrarDecisaoNoMock.mockImplementation(real.registrarDecisaoNoMock);
        rota.id = real.criarConciliacao().id;
        const user = userEvent.setup();
        render(<ConciliacaoPage />);

        await user.click(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" }));
        const janela = screen.getByRole("dialog", { name: "Boleto Aço Norte Bobinas" });
        expect(janela).toHaveTextContent(
          "Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro.",
        );
        await user.type(
          within(janela).getByLabelText("Justificativa"),
          "Juros de dois dias de atraso, lançados como despesa financeira.",
        );
        await user.click(within(janela).getByRole("button", { name: "Justificar" }));

        const linha = screen.getByRole("button", { name: "Boleto Aço Norte Bobinas" }).closest("tr")!;
        expect(within(linha).getAllByRole("cell")[3]).toHaveTextContent("Justificada");
        // a janela passa a mostrar a justificativa feita, e o caminho de volta
        expect(janela).toHaveTextContent("Justificada por Você em");
        expect(janela).toHaveTextContent("Juros de dois dias de atraso, lançados como despesa financeira.");
        expect(within(janela).getByRole("button", { name: "Desfazer justificativa" })).toBeInTheDocument();
      });

      it("does not justify with a blank text", async () => {
        doBackend(comCampo);
        const user = userEvent.setup();
        render(<ConciliacaoPage />);

        await user.click(await screen.findByRole("button", { name: "Tarifa TED" }));
        const janela = screen.getByRole("dialog", { name: "Tarifa TED" });
        const campo = within(janela).getByLabelText("Justificativa");
        await user.type(campo, "   ");
        await user.click(within(janela).getByRole("button", { name: "Justificar" }));

        expect(registrarDecisao).not.toHaveBeenCalled();
        expect(campo).toHaveAttribute("aria-invalid", "true");
      });

      it("keeps the text when saving fails, and does not send twice while saving", async () => {
        doBackend(comCampo);
        let falhar: (erro: Error) => void = () => {};
        registrarDecisao.mockReturnValue(new Promise((_, rejeitar) => (falhar = rejeitar)));
        const user = userEvent.setup();
        render(<ConciliacaoPage />);

        await user.click(await screen.findByRole("button", { name: "Tarifa TED" }));
        const janela = screen.getByRole("dialog", { name: "Tarifa TED" });
        const campo = within(janela).getByLabelText("Justificativa");
        await user.type(campo, "Tarifa do pacote, contratada; não entra no sistema.");
        const botao = within(janela).getByRole("button", { name: "Justificar" });
        await user.click(botao);

        expect(botao).toBeDisabled();
        expect(botao).toHaveAttribute("aria-busy", "true");
        await user.click(botao);
        expect(registrarDecisao).toHaveBeenCalledTimes(1);
        expect(registrarDecisao).toHaveBeenCalledWith(
          BANCO,
          "b:lc-4",
          "justificada",
          "Tarifa do pacote, contratada; não entra no sistema.",
        );

        await act(async () => falhar(new Error("Failed to fetch")));
        expect(campo).toHaveValue("Tarifa do pacote, contratada; não entra no sistema.");
        expect(within(janela).getByRole("alert")).toHaveTextContent("Não foi possível falar com o servidor.");
        expect(botao).toBeEnabled();
      });

      it("shows who justified, when and why, and undoes it back to be checked", async () => {
        doBackend({
          ...comCampo,
          linhas: comCampo.linhas.map((linha) =>
            linha.id === "lc-2" ? { ...linha, decisao: decisao("justificada") } : linha,
          ),
        });
        registrarDecisao.mockResolvedValue({ ok: true, dados: null });
        const user = userEvent.setup();
        render(<ConciliacaoPage />);

        await user.click(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" }));
        const janela = screen.getByRole("dialog", { name: "Boleto Aço Norte Bobinas" });
        expect(janela).toHaveTextContent("Justificada por Eduardo Sichelero em 30/09/2026 10:12");
        expect(janela).toHaveTextContent("Juros de dois dias de atraso.");

        // a janela abre com o foco no Fechar: um Enter logo de cara não desfaz nada
        expect(within(janela).getByRole("button", { name: "Fechar" })).toHaveFocus();

        await user.click(within(janela).getByRole("button", { name: "Desfazer justificativa" }));
        expect(registrarDecisao).toHaveBeenCalledWith(BANCO, "b:lc-2", "justificativa_desfeita", undefined);
        // volta para A conferir: a caixa vazia de novo, e o campo para justificar
        expect(
          screen.getByRole("button", { name: "Marcar Boleto Aço Norte Bobinas como conferida" }),
        ).toHaveAttribute("aria-pressed", "false");
        expect(within(janela).getByLabelText("Justificativa")).toBeInTheDocument();
      });

      it("only reads on an old round, and offers nothing without decisions from the backend", async () => {
        doBackend(
          {
            ...comCampo,
            linhas: comCampo.linhas.map((linha) =>
              linha.id === "lc-2" ? { ...linha, decisao: decisao("justificada") } : linha,
            ),
          },
          { rodada: { ...RODADA_2, numero: 1 } },
        );
        const user = userEvent.setup();
        const antiga = render(<ConciliacaoPage />);

        await user.click(await screen.findByRole("button", { name: "Boleto Aço Norte Bobinas" }));
        let janela = screen.getByRole("dialog", { name: "Boleto Aço Norte Bobinas" });
        // a justificativa se lê, mas não se desfaz numa rodada passada
        expect(janela).toHaveTextContent("Justificada por Eduardo Sichelero em 30/09/2026 10:12");
        expect(within(janela).queryByRole("button", { name: "Desfazer justificativa" })).not.toBeInTheDocument();
        await user.click(within(janela).getByRole("button", { name: "Fechar" }));
        await user.click(screen.getByRole("button", { name: "Tarifa TED" }));
        janela = screen.getByRole("dialog", { name: "Tarifa TED" });
        expect(within(janela).queryByLabelText("Justificativa")).not.toBeInTheDocument();
        antiga.unmount();

        doBackend(conciliacaoDoRelatorio);
        render(<ConciliacaoPage />);
        await user.click(await screen.findByRole("button", { name: "Tarifa TED" }));
        janela = screen.getByRole("dialog", { name: "Tarifa TED" });
        expect(within(janela).queryByLabelText("Justificativa")).not.toBeInTheDocument();
      });
    });
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

    const padrao = await screen.findByRole("button", { name: "Padrão" });
    // a compacta é o padrão: facilita a leitura de uma tabela longa
    expect(screen.getByRole("button", { name: "Compacta" })).toHaveAttribute("aria-pressed", "true");

    await user.click(padrao);

    expect(padrao).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.densidade).toBe("padrao");
    expect(window.localStorage.getItem("ledgr_densidade")).toBe("padrao");
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { Resultado, VisaoGeral } from "./conciliacoes/acoes";
import { BarraSuperior } from "./barra-superior";
import { ProvedorDaConta } from "./conta";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import type { Assinatura } from "@/lib/assinatura";
import type { AchadoDaBusca, PaginaDaBusca, ResultadoDaBusca } from "./busca/acoes";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/conciliacoes/nova",
}));

// os avisos leem a conciliação mais recente; a busca tem sua própria action
const carregarVisaoGeral = vi.fn<() => Promise<Resultado<VisaoGeral>>>();
vi.mock("./conciliacoes/acoes", () => ({
  carregarVisaoGeral: () => carregarVisaoGeral(),
}));
const buscarLancamentos = vi.fn<(termo: string, offset?: number) => Promise<ResultadoDaBusca>>();
vi.mock("./busca/acoes", () => ({ buscarLancamentos: (termo: string, offset: number) => buscarLancamentos(termo, offset) }));

const ACHADOS: AchadoDaBusca[] = [
  { id: "lc-1", href: "/conciliacoes/b/lc-1?sistema=s", descricao: "Boleto Aço Norte Bobinas", data: "2026-09-04", valor: 12640, competencia: "2026-09" },
  { id: "lc-2", href: "/conciliacoes/outro/lc-2?sistema=anterior", descricao: "Folha de pagamento agosto", data: "2026-08-05", valor: 48200, competencia: "2026-08" },
];
const paginaDaBusca = (itens = ACHADOS, total = itens.length, offset = 0) => ({ ok: true as const, dados: { itens, total, offset, limit: 10 } });

const EXECUCAO = { id: "e7", executadaEm: "2026-09-26T13:28:00Z" } as Execucao;

const VISAO: VisaoGeral = {
  execucoes: [EXECUCAO],
  total: 1,
  recente: {
    execucao: EXECUCAO,
    conciliacao: {
      id: "b",
      extratoSistemaId: "s",
      mes: "Setembro/2026",
      status: "em_andamento",
      linhas: [
        {
          id: "lc-1",
          descricao: "Boleto Aço Norte Bobinas",
          data: "04/09",
          valorBanco: 12640,
          valorSistema: 12604,
          status: "divergente_valor",
          explicacao: null,
          historico: [],
        },
        {
          id: "lc-2",
          descricao: "Folha de pagamento setembro",
          data: "05/09",
          valorBanco: 48200,
          valorSistema: 48200,
          status: "match_exato",
          explicacao: null,
          historico: [],
        },
      ],
    },
  },
  arquivosComLinhasNaoLidas: [],
};

/** Espera a leitura dos avisos; a busca não depende dela. */
async function montar() {
  const tela = render(<BarraSuperior />);
  await screen.findByRole("button", { name: /Avisos \d/ });
  return tela;
}

describe("BarraSuperior", () => {
  beforeEach(() => {
    carregarVisaoGeral.mockReset();
    carregarVisaoGeral.mockResolvedValue({ ok: true, dados: VISAO });
    buscarLancamentos.mockReset().mockResolvedValue(paginaDaBusca());
    push.mockReset();
    window.localStorage.clear();
  });
  it("a Ajuda, ao lado de Avisos, ainda reabre o tutorial da tela", async () => {
    const ouvinte = vi.fn();
    window.addEventListener("ledgr:abrir-tutorial", ouvinte);
    const user = userEvent.setup();
    await montar();
    await user.click(screen.getByRole("button", { name: "Ajuda" }));
    await user.click(screen.getByRole("button", { name: /Rever o tutorial/ }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener("ledgr:abrir-tutorial", ouvinte);
  });


  afterEach(() => {
    vi.useRealTimers();
    delete (window.navigator as unknown as Record<string, unknown>).platform;
  });

  function fingirPlataforma(valor: string) {
    Object.defineProperty(window.navigator, "platform", { value: valor, configurable: true });
  }

  it("depois de uma escrita recusada por conta inativa (backend #156), avisa em tom de risco, com e-mail para o Ledgr", async () => {
    render(<BarraSuperior contaInativa />);
    await screen.findByRole("button", { name: /Avisos \d/ });
    const aviso = screen.getByRole("link", { name: "Conta inativa · falar com o Ledgr" });
    expect(aviso).toHaveClass("selo-risco");
    expect(aviso).toHaveAttribute("href", "mailto:ledgrtech@gmail.com?subject=Reativar%20a%20conta");
  });

  it("sem a recusa, não fala de conta inativa", async () => {
    await montar();
    expect(screen.queryByText(/Conta inativa/)).not.toBeInTheDocument();
  });

  it("leaves the account and the theme to the side menu", async () => {
    await montar();
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tema/ })).not.toBeInTheDocument();
  });

  it("shows no results panel until something is typed", async () => {
    await montar();
    expect(screen.queryByText("Boleto Aço Norte Bobinas")).not.toBeInTheDocument();
  });

  it("busca a descrição pelo backend e abre a linha no par que veio dele", async () => {
    buscarLancamentos.mockResolvedValue(paginaDaBusca([ACHADOS[0]]));
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");

    const achado = await screen.findByRole("option", { name: /Boleto Aço Norte Bobinas/ });
    expect(achado).toHaveAttribute("href", "/conciliacoes/b/lc-1?sistema=s");
    expect(screen.queryByRole("option", { name: /Folha de pagamento agosto/ })).not.toBeInTheDocument();
    expect(buscarLancamentos).toHaveBeenCalledExactlyOnceWith("aço norte", 0);
  });

  it("finds a lançamento by its value", async () => {
    buscarLancamentos.mockResolvedValue(paginaDaBusca([ACHADOS[1]]));
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "48.200");

    expect(await screen.findByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();
    expect(buscarLancamentos).toHaveBeenCalledExactlyOnceWith("48.200", 0);
  });

  it("finds a lançamento by date", async () => {
    buscarLancamentos.mockResolvedValue(paginaDaBusca([ACHADOS[0]]));
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "04/09");

    expect(await screen.findByRole("option", { name: /Boleto Aço Norte Bobinas/ })).toBeInTheDocument();
    expect(buscarLancamentos).toHaveBeenCalledExactlyOnceWith("04/09", 0);
  });

  it("explica uma busca vazia e a anuncia na região já montada", async () => {
    buscarLancamentos.mockResolvedValue(paginaDaBusca([]));
    const user = userEvent.setup();
    await montar();
    const anuncio = screen.getByRole("status");
    expect(anuncio).toBeEmptyDOMElement();

    await user.type(screen.getByLabelText("Buscar lançamento"), "xpto");

    expect(await screen.findByText("Nada encontrado. Tente o valor sem centavos, a data (13/10) ou parte do nome do fornecedor.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBe(anuncio);
    expect(anuncio).toHaveTextContent("Nada encontrado");
  });

  it("a busca funciona sem a conciliação recente dos avisos", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
    });
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço");

    expect(await screen.findByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();
  });

  it("closes the search panel on Escape", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço");
    expect(await screen.findByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option", { name: /Boleto Aço Norte/ })).not.toBeInTheDocument();
  });

  it("focuses the search box on the announced shortcut", async () => {
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    expect(campo).not.toHaveFocus();
    await user.keyboard("{Control>}k{/Control}");
    expect(campo).toHaveFocus();
  });

  it("announces the search shortcut with Ctrl on Windows", async () => {
    fingirPlataforma("Win32");
    const { container } = await montar();
    expect(container.querySelector(".app-busca-atalho")).toHaveTextContent("Ctrl K");
  });

  it("announces the search shortcut with ⌘ on a Mac", async () => {
    fingirPlataforma("MacIntel");
    const { container } = await montar();
    expect(container.querySelector(".app-busca-atalho")).toHaveTextContent("⌘K");
  });

  it("also focuses the search box with ⌘K, whatever the label says", async () => {
    fingirPlataforma("Win32");
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.keyboard("{Meta>}k{/Meta}");
    expect(campo).toHaveFocus();
  });

  it("announces itself as a combobox driving the results list", async () => {
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    expect(campo).toHaveAttribute("role", "combobox");
    expect(campo).toHaveAttribute("aria-expanded", "false");

    await user.type(campo, "a");

    expect(campo).toHaveAttribute("aria-expanded", "true");
    expect(campo).toHaveAttribute("aria-controls", "busca-resultados");
    expect(screen.getByRole("listbox", { name: "Resultados da busca" })).toBeInTheDocument();
  });

  it("walks the results with the arrow keys", async () => {
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.type(campo, "o");
    const opcoes = await screen.findAllByRole("option");
    expect(opcoes).toHaveLength(2);
    expect(campo).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");
    expect(opcoes[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-1");

    // volta ao primeiro dando a volta
    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");
    await user.keyboard("{ArrowUp}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-1");
  });

  it("opens the highlighted result with Enter", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");
    await screen.findByRole("option", { name: /Boleto Aço Norte/ });
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/conciliacoes/b/lc-1?sistema=s");
  });

  it("does nothing on Enter while no result is highlighted", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");
    await screen.findByRole("option", { name: /Boleto Aço Norte/ });
    await user.keyboard("{Enter}");

    expect(push).not.toHaveBeenCalled();
  });

  it("resets the highlight when the query changes", async () => {
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.type(campo, "o");
    await screen.findAllByRole("option");
    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");

    await user.type(campo, "l");
    expect(campo).not.toHaveAttribute("aria-activedescendant");
  });

  describe("busca na conta de demonstração", () => {
    beforeEach(() => buscarLancamentos.mockResolvedValue({ ok: false, status: "demonstracao" }));

    it.each([" AÇO NORTE ", "04/09", "12.640", "12.604"])("filtra localmente por descrição, data e ambos os valores (%s)", async (termo) => {
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), termo);

      const resultado = await screen.findByRole("option", { name: /Boleto Aço Norte/ });
      expect(resultado).toHaveAttribute("href", "/conciliacoes/b/lc-1?sistema=s");
      expect(resultado).toHaveTextContent(/04\/09 · R\$\s12\.640,00/);
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent("1 resultado");
      expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
    });

    it("lembra o modo local ao digitar, limpar e procurar outro termo", async () => {
      vi.useFakeTimers();
      render(<BarraSuperior />);
      const campo = screen.getByRole("combobox");
      fireEvent.change(campo, { target: { value: "aço" } });
      await act(async () => vi.advanceTimersByTimeAsync(250));
      expect(screen.getByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();

      fireEvent.change(campo, { target: { value: "" } });
      await act(async () => vi.advanceTimersByTimeAsync(500));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      fireEvent.change(campo, { target: { value: "folha" } });
      await act(async () => vi.advanceTimersByTimeAsync(500));

      expect(screen.getByRole("option", { name: /Folha de pagamento setembro/ })).toBeInTheDocument();
      expect(buscarLancamentos).toHaveBeenCalledExactlyOnceWith("aço", 0);
    });

    it("lembra o aviso de demonstração mesmo se o termo já foi limpo quando ele chega", async () => {
      vi.useFakeTimers();
      let concluir!: (resposta: ResultadoDaBusca) => void;
      buscarLancamentos.mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
      render(<BarraSuperior />);
      const campo = screen.getByRole("combobox");
      fireEvent.change(campo, { target: { value: "aço" } });
      await act(async () => vi.advanceTimersByTimeAsync(250));
      fireEvent.change(campo, { target: { value: "" } });

      await act(async () => concluir({ ok: false, status: "demonstracao" }));
      fireEvent.change(campo, { target: { value: "folha" } });
      await act(async () => vi.advanceTimersByTimeAsync(250));

      expect(screen.getByRole("option", { name: /Folha de pagamento setembro/ })).toBeInTheDocument();
      expect(buscarLancamentos).toHaveBeenCalledExactlyOnceWith("aço", 0);
    });

    it("mostra até oito linhas da conciliação recente, sem paginação", async () => {
      carregarVisaoGeral.mockResolvedValue({ ok: true, dados: {
        ...VISAO,
        recente: { ...VISAO.recente!, conciliacao: {
          ...VISAO.recente!.conciliacao,
          linhas: Array.from({ length: 10 }, (_, i) => ({ ...VISAO.recente!.conciliacao.linhas[0], id: `local-${i}`, descricao: `Fornecedor local ${i}` })),
        } },
      } });
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");

      expect(await screen.findAllByRole("option")).toHaveLength(8);
      expect(screen.getByRole("status")).toHaveTextContent("8 resultados");
      expect(screen.queryByRole("option", { name: /Fornecedor local 8/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
    });

    it.each([false, true])("mantém os textos de vazio da busca local (sem conciliação: %s)", async (semConciliacao) => {
      if (semConciliacao) carregarVisaoGeral.mockResolvedValue({ ok: true, dados: { ...VISAO, execucoes: [], total: 0, recente: null } });
      const user = userEvent.setup();
      await montar();
      const anuncio = screen.getByRole("status");
      await user.type(screen.getByRole("combobox"), "xpto");

      expect(await screen.findByText(semConciliacao
        ? "Ainda não há conciliação para buscar."
        : "Nada encontrado na conciliação mais recente. Tente o valor sem centavos ou parte do nome do fornecedor.")).toBeInTheDocument();
      expect(screen.getByRole("status")).toBe(anuncio);
      expect(anuncio).toHaveTextContent("Nada encontrado");
      expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
    });

    it("aguarda a leitura dos avisos e usa os dados quando chegam, sem chamar outra busca", async () => {
      let concluir!: (resposta: Resultado<VisaoGeral>) => void;
      carregarVisaoGeral.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
      const user = userEvent.setup();
      render(<BarraSuperior />);
      await user.type(screen.getByRole("combobox"), "aço");
      await waitFor(() => expect(buscarLancamentos).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("status")).toHaveTextContent("Buscando…");
      expect(screen.queryByText(/Nada encontrado/)).not.toBeInTheDocument();

      await act(async () => concluir({ ok: true, dados: VISAO }));

      expect(screen.getByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();
      expect(buscarLancamentos).toHaveBeenCalledTimes(1);
    });

    it("falha ao ler a conciliação local não vira um resultado vazio", async () => {
      carregarVisaoGeral.mockResolvedValue({ ok: false, status: 0, erro: SEM_SERVIDOR });
      const user = userEvent.setup();
      render(<BarraSuperior />);
      await user.type(screen.getByRole("combobox"), "aço");

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(SEM_SERVIDOR));
      expect(screen.queryByText(/Nada encontrado/)).not.toBeInTheDocument();
    });

    it("mantém setas, Enter, aria e a devolução de foco no Esc", async () => {
      const user = userEvent.setup();
      await montar();
      const campo = screen.getByRole("combobox");
      await user.type(campo, "o");
      const opcoes = await screen.findAllByRole("option");
      expect(opcoes).toHaveLength(2);
      await user.keyboard("{ArrowDown}");
      expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");
      expect(opcoes[0]).toHaveAttribute("aria-selected", "true");
      await user.keyboard("{Enter}");
      expect(push).toHaveBeenCalledWith("/conciliacoes/b/lc-1?sistema=s");

      await user.type(campo, " ");
      screen.getByRole("option", { name: /Boleto Aço Norte/ }).focus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(campo).toHaveFocus();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  describe("busca em todas as conciliações", () => {
    it.each(["resultado", "Ver mais"])("Esc com foco em %s fecha o painel e devolve o foco ao campo", async (alvo) => {
      buscarLancamentos.mockResolvedValue(paginaDaBusca([ACHADOS[0]], 11));
      const user = userEvent.setup();
      await montar();
      const campo = screen.getByRole("combobox");
      await user.type(campo, "fornecedor");
      const resultado = await screen.findByRole("option", { name: /Boleto Aço Norte/ });
      const elemento = alvo === "resultado" ? resultado : screen.getByRole("button", { name: "Ver mais" });
      elemento.focus();
      expect(elemento).toHaveFocus();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(campo).toHaveFocus();
    });

    it("Esc com o foco fora da busca não o move para o campo", async () => {
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      await screen.findAllByRole("option");
      const outro = screen.getByRole("button", { name: "Ajuda" });
      outro.focus();
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(outro).toHaveFocus();
    });

    it("Ver mais devolve o foco ao campo antes de desabilitar e conserva-o na última página", async () => {
      let concluir!: (resposta: Resultado<PaginaDaBusca>) => void;
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca([ACHADOS[0]], 11))
        .mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
      const user = userEvent.setup();
      await montar();
      const campo = screen.getByRole("combobox");
      await user.type(campo, "fornecedor");
      const mais = await screen.findByRole("button", { name: "Ver mais" });

      await user.click(mais);
      expect(mais).toBeDisabled();
      expect(campo).toHaveFocus();

      await act(async () => concluir(paginaDaBusca([ACHADOS[1]], 11, 10)));
      expect(mais).not.toBeInTheDocument();
      expect(campo).toHaveFocus();
    });

    it("Ver mais não rouba o foco que já estava fora do botão", async () => {
      let concluir!: (resposta: Resultado<PaginaDaBusca>) => void;
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca([ACHADOS[0]], 11))
        .mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      const mais = await screen.findByRole("button", { name: "Ver mais" });
      const outro = screen.getByRole("button", { name: "Ajuda" });
      outro.focus();

      // Acionamento sem mover o foco, como um clique virtual de tecnologia assistiva.
      fireEvent.click(mais);
      expect(mais).toBeDisabled();
      expect(outro).toHaveFocus();

      await act(async () => concluir(paginaDaBusca([ACHADOS[1]], 11, 10)));
      expect(mais).not.toBeInTheDocument();
      expect(outro).toHaveFocus();
    });

    it("a resposta de Ver mais não recupera o foco que saiu da busca durante a leitura", async () => {
      let concluir!: (resposta: Resultado<PaginaDaBusca>) => void;
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca([ACHADOS[0]], 11))
        .mockReturnValueOnce(new Promise((resolve) => { concluir = resolve; }));
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      await user.click(await screen.findByRole("button", { name: "Ver mais" }));
      const outro = screen.getByRole("button", { name: "Ajuda" });
      await user.click(outro);

      await act(async () => concluir(paginaDaBusca([ACHADOS[1]], 11, 10)));

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(outro).toHaveFocus();
    });

    it("repetir o termo depois de limpar espera uma nova leitura, sem reapresentar os resultados antigos", async () => {
      let nova!: (resposta: Resultado<PaginaDaBusca>) => void;
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca([ACHADOS[0]]))
        .mockReturnValueOnce(new Promise((resolve) => { nova = resolve; }));
      const user = userEvent.setup();
      await montar();
      const campo = screen.getByRole("combobox");
      await user.type(campo, "fornecedor");
      await screen.findByRole("option", { name: /Boleto Aço Norte/ });

      await user.clear(campo);
      await user.type(campo, "fornecedor");
      await waitFor(() => expect(buscarLancamentos).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Buscando…");

      await act(async () => nova(paginaDaBusca([ACHADOS[1]])));
      expect(screen.getByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();
    });

    it("espera 250 ms desde a última tecla e não chama a action com espaços", async () => {
      vi.useFakeTimers();
      render(<BarraSuperior />);
      const campo = screen.getByRole("combobox", { name: "Buscar lançamento" });
      fireEvent.change(campo, { target: { value: "aço" } });
      await act(async () => vi.advanceTimersByTimeAsync(249));
      expect(buscarLancamentos).not.toHaveBeenCalled();

      fireEvent.change(campo, { target: { value: " Aço Norte " } });
      await act(async () => vi.advanceTimersByTimeAsync(249));
      expect(buscarLancamentos).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(buscarLancamentos).toHaveBeenCalledExactlyOnceWith("Aço Norte", 0);
      expect(screen.getAllByRole("option")).toHaveLength(2);

      fireEvent.change(campo, { target: { value: "   " } });
      await act(async () => vi.advanceTimersByTimeAsync(250));
      expect(buscarLancamentos).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("uma resposta antiga não substitui a busca nova", async () => {
      let antiga!: (resposta: Resultado<PaginaDaBusca>) => void;
      buscarLancamentos
        .mockReturnValueOnce(new Promise((resolve) => { antiga = resolve; }))
        .mockResolvedValueOnce(paginaDaBusca([ACHADOS[1]]));
      const user = userEvent.setup();
      await montar();
      const campo = screen.getByRole("combobox");
      await user.type(campo, "antigo");
      await waitFor(() => expect(buscarLancamentos).toHaveBeenCalledTimes(1));
      await user.clear(campo);
      await user.type(campo, "novo");
      expect(await screen.findByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();

      await act(async () => antiga(paginaDaBusca([ACHADOS[0]])));
      expect(screen.getAllByRole("option")).toHaveLength(1);
      expect(screen.getByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /Boleto Aço Norte/ })).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("1 resultado");
    });

    it("trocar de empresa refaz a busca e descarta a resposta da empresa anterior", async () => {
      const A = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Alfa", cnpj: "11222333000181" };
      const B = { ...A, id: "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d", razaoSocial: "Beta" };
      let antiga!: (resposta: Resultado<PaginaDaBusca>) => void;
      buscarLancamentos
        .mockReturnValueOnce(new Promise((resolve) => { antiga = resolve; }))
        .mockResolvedValueOnce(paginaDaBusca([ACHADOS[1]]));
      const user = userEvent.setup();
      const tela = render(<ProvedorDaEmpresa ativa={A} empresas={[A, B]}><BarraSuperior /></ProvedorDaEmpresa>);
      await user.type(screen.getByRole("combobox"), "fornecedor");
      await waitFor(() => expect(buscarLancamentos).toHaveBeenCalledTimes(1));
      tela.rerender(<ProvedorDaEmpresa ativa={B} empresas={[A, B]}><BarraSuperior /></ProvedorDaEmpresa>);
      expect(await screen.findByRole("option", { name: /Folha de pagamento agosto/ })).toHaveAttribute("href", `/e/${B.id}${ACHADOS[1].href}`);

      await act(async () => antiga(paginaDaBusca([ACHADOS[0]])));
      expect(screen.queryByRole("option", { name: /Boleto Aço Norte/ })).not.toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();
    });

    it("mostra data, moeda e mês; sem competência, não inventa mês", async () => {
      buscarLancamentos.mockResolvedValue(paginaDaBusca([ACHADOS[0], { ...ACHADOS[1], competencia: null }]));
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      const banco = await screen.findByRole("option", { name: /Boleto Aço Norte/ });
      expect(banco).toHaveTextContent(/04\/09\/2026 · R\$\s12\.640,00/);
      expect(within(banco).getByText("set/2026")).toHaveClass("tag");
      const outro = screen.getByRole("option", { name: /Folha de pagamento agosto/ });
      expect(outro).toHaveTextContent("05/08/2026");
      expect(outro.querySelector(".tag")).toBeNull();
    });

    it("Ver mais fica fora do listbox, acrescenta a página e anuncia a nova contagem", async () => {
      const primeira = Array.from({ length: 10 }, (_, i) => ({ ...ACHADOS[0], id: `linha-${i}`, descricao: `Lançamento ${i}`, href: `/conciliacoes/b/linha-${i}?sistema=s` }));
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca(primeira, 12))
        .mockResolvedValueOnce(paginaDaBusca(ACHADOS, 12, 10));
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      const mais = await screen.findByRole("button", { name: "Ver mais" });
      expect(screen.getAllByRole("option")).toHaveLength(10);
      expect(screen.getByRole("listbox")).not.toContainElement(mais);
      await user.click(mais);

      expect(await screen.findByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();
      expect(screen.getAllByRole("option")).toHaveLength(12);
      expect(buscarLancamentos).toHaveBeenLastCalledWith("fornecedor", 10);
      expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("12 resultados");
    });

    it("Ver mais avança a página mesmo se a action descartou itens malformados", async () => {
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca([ACHADOS[0]], 11))
        .mockResolvedValueOnce(paginaDaBusca([ACHADOS[1]], 11, 10));
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      await user.click(await screen.findByRole("button", { name: "Ver mais" }));

      expect(await screen.findByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();
      expect(buscarLancamentos).toHaveBeenLastCalledWith("fornecedor", 10);
      expect(screen.getAllByRole("option")).toHaveLength(2);
      expect(screen.queryByRole("button", { name: "Ver mais" })).not.toBeInTheDocument();
    });

    it("uma falha no Ver mais conserva os resultados e permite tentar a mesma página", async () => {
      buscarLancamentos.mockResolvedValueOnce(paginaDaBusca([ACHADOS[0]], 11))
        .mockResolvedValueOnce({ ok: false, status: 429, erro: "Muitas buscas seguidas. Espere um pouco." })
        .mockResolvedValueOnce(paginaDaBusca([ACHADOS[1]], 11, 10));
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      await user.click(await screen.findByRole("button", { name: "Ver mais" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Muitas buscas seguidas. Espere um pouco."));
      expect(screen.getByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Ver mais" }));

      expect(await screen.findByRole("option", { name: /Folha de pagamento agosto/ })).toBeInTheDocument();
      expect(buscarLancamentos.mock.calls.map(([, offset]) => offset)).toEqual([0, 10, 10]);
    });

    it("rejeição da Server Action anuncia SEM_SERVIDOR sem virar resultado vazio", async () => {
      buscarLancamentos.mockRejectedValue(new Error("rede"));
      const user = userEvent.setup();
      await montar();
      const anuncio = screen.getByRole("status");
      await user.type(screen.getByRole("combobox"), "fornecedor");

      await waitFor(() => expect(anuncio).toHaveTextContent(SEM_SERVIDOR));
      expect(screen.queryByRole("option")).not.toBeInTheDocument();
      expect(screen.queryByText("Nada encontrado")).not.toBeInTheDocument();
    });

    it("o clique fora fecha a busca e esvazia o anúncio", async () => {
      const user = userEvent.setup();
      await montar();
      await user.type(screen.getByRole("combobox"), "fornecedor");
      await screen.findAllByRole("option");
      await user.click(document.body);

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });
  });

  it("counts real notices, and leads each one to where it can be solved", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { ...VISAO, arquivosComLinhasNaoLidas: [{ nome: "itau.ofx", linhas: 2 }] },
    });
    const user = userEvent.setup();
    render(<BarraSuperior />);

    await user.click(await screen.findByRole("button", { name: "Avisos 2" }));

    expect(screen.getByRole("link", { name: /1 divergência aguardando decisão/ })).toHaveAttribute(
      "href",
      "/conciliacoes/b?sistema=s",
    );
    expect(screen.getByRole("link", { name: /2 linhas não lidas em itau\.ofx/ })).toHaveAttribute("href", "/extratos");
    // nada de aviso inventado
    expect(screen.queryByText(/Extrato de outubro/)).not.toBeInTheDocument();
  });

  it("marks the notices as read, and remembers it on the next visit", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BarraSuperior />);

    await user.click(await screen.findByRole("button", { name: "Avisos 1" }));
    await user.click(screen.getByRole("button", { name: "Marcar como lidos" }));

    expect(screen.getByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como lidos" })).not.toBeInTheDocument();
    unmount();

    render(<BarraSuperior />);
    expect(await screen.findByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
  });

  it("guarda os avisos lidos de cada empresa sem apagar os das outras", async () => {
    const A = { id: "emp-a", razaoSocial: "Alfa Ltda", cnpj: "11222333000181" };
    const B = { id: "emp-b", razaoSocial: "Beta Ltda", cnpj: "11444777000161" };
    const visaoDe = (idExecucao: string): VisaoGeral => ({
      ...VISAO,
      execucoes: [{ ...EXECUCAO, id: idExecucao }],
      recente: { ...VISAO.recente!, execucao: { ...EXECUCAO, id: idExecucao } },
    });
    const user = userEvent.setup();

    carregarVisaoGeral.mockResolvedValueOnce({ ok: true, dados: visaoDe("e-alfa") });
    const primeira = render(
      <ProvedorDaEmpresa ativa={A} empresas={[A, B]}>
        <BarraSuperior />
      </ProvedorDaEmpresa>,
    );
    await user.click(await screen.findByRole("button", { name: "Avisos 1" }));
    await user.click(screen.getByRole("button", { name: "Marcar como lidos" }));
    expect(screen.getByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
    primeira.unmount();

    carregarVisaoGeral.mockResolvedValueOnce({ ok: true, dados: visaoDe("e-beta") });
    const segunda = render(
      <ProvedorDaEmpresa ativa={B} empresas={[A, B]}>
        <BarraSuperior />
      </ProvedorDaEmpresa>,
    );
    await user.click(await screen.findByRole("button", { name: "Avisos 1" }));
    await user.click(screen.getByRole("button", { name: "Marcar como lidos" }));
    expect(screen.getByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
    segunda.unmount();

    carregarVisaoGeral.mockResolvedValueOnce({ ok: true, dados: visaoDe("e-alfa") });
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A, B]}>
        <BarraSuperior />
      </ProvedorDaEmpresa>,
    );
    expect(await screen.findByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
  });

  it("says when there is nothing to report, and when the notices could not be read", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { ...VISAO, recente: { ...VISAO.recente!, conciliacao: { ...VISAO.recente!.conciliacao, linhas: [] } } },
    });
    const user = userEvent.setup();
    const { unmount } = render(<BarraSuperior />);
    await user.click(await screen.findByRole("button", { name: "Avisos 0" }));
    expect(screen.getByText("Nenhum aviso agora.")).toBeInTheDocument();
    unmount();

    carregarVisaoGeral.mockResolvedValue({ ok: false, status: 0, erro: "x" });
    render(<BarraSuperior />);
    await user.click(screen.getByRole("button", { name: "Avisos" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível ler os avisos agora.");
  });

  describe("o teste de 14 dias", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-20T12:00:00-03:00"));
    });
    afterEach(() => vi.useRealTimers());

    async function montarBarra(assinatura: Assinatura | null) {
      render(
        <ProvedorDaConta preferencias={null} assinatura={assinatura}>
          <BarraSuperior />
        </ProvedorDaConta>,
      );
      await screen.findByRole("button", { name: /Avisos \d/ });
    }

    it("no teste, mostra quantos dias faltam com link para a Assinatura", async () => {
      await montarBarra({ situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29", fimDoTeste: null, cobranca: null });
      expect(screen.getByRole("link", { name: "Teste grátis · faltam 9 dias" })).toHaveAttribute("href", "/assinatura");
    });

    it.each([
      ["teste_encerrado", "Seu teste acabou · assinar um plano", "Teste acabou"],
      ["assinatura_encerrada", "Assinatura encerrada · assinar de novo", "Encerrada"],
      ["pagamento_pendente", "Pagamento pendente", "Pagamento"],
    ] as const)("%s: aviso em tom de risco que leva à Assinatura", async (situacao, frase, curta) => {
      await montarBarra({ situacao, plano: "padrao", testeTerminaEm: null, fimDoTeste: null, cobranca: null });
      const aviso = screen.getByRole("link", { name: frase });
      expect(aviso).toHaveClass("selo-risco");
      expect(aviso).toHaveAttribute("href", "/assinatura");
      expect(within(aviso).getByText(curta)).toBeInTheDocument();
    });

    it("sem assinatura ou com o plano ativo, não mostra nada", async () => {
      await montarBarra(null);
      expect(screen.queryByText(/Teste grátis|Seu teste acabou/)).not.toBeInTheDocument();
    });
  });
});

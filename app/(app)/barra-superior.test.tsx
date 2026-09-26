import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { Resultado, VisaoGeral } from "./conciliacoes/acoes";
import { BarraSuperior } from "./barra-superior";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// a busca e os avisos leem a conciliação mais recente, como a visão geral
const carregarVisaoGeral = vi.fn<() => Promise<Resultado<VisaoGeral>>>();
vi.mock("./conciliacoes/acoes", () => ({
  carregarVisaoGeral: () => carregarVisaoGeral(),
}));

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

/** Monta e espera a leitura: antes dela a busca não tem onde procurar. */
async function montar() {
  const tela = render(<BarraSuperior />);
  await screen.findByRole("button", { name: /Avisos \d/ });
  return tela;
}

describe("BarraSuperior", () => {
  beforeEach(() => {
    carregarVisaoGeral.mockReset();
    carregarVisaoGeral.mockResolvedValue({ ok: true, dados: VISAO });
    push.mockReset();
    window.localStorage.clear();
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

  it("finds a lançamento of the latest conciliation by description, and opens it in its pair", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");

    const achado = screen.getByRole("option", { name: /Boleto Aço Norte Bobinas/ });
    expect(achado).toHaveAttribute("href", "/conciliacoes/b/lc-1?sistema=s");
    expect(screen.queryByText("Folha de pagamento setembro")).not.toBeInTheDocument();
  });

  it("finds a lançamento by its value", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "48.200");

    expect(screen.getByRole("option", { name: /Folha de pagamento setembro/ })).toBeInTheDocument();
  });

  it("finds a lançamento by date", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "04/09");

    expect(screen.getByRole("option", { name: /Boleto Aço Norte Bobinas/ })).toBeInTheDocument();
  });

  it("explains an empty result, saying where it looked", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "xpto");

    expect(screen.getByText(/Nada encontrado na conciliação mais recente/)).toBeInTheDocument();
  });

  it("says there is nothing to search before the first conciliation", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
    });
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço");

    expect(screen.getByText("Ainda não há conciliação para buscar.")).toBeInTheDocument();
  });

  it("closes the search panel on Escape", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço");
    expect(screen.getByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();

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
    const opcoes = screen.getAllByRole("option");
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
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/conciliacoes/b/lc-1?sistema=s");
  });

  it("does nothing on Enter while no result is highlighted", async () => {
    const user = userEvent.setup();
    await montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");
    await user.keyboard("{Enter}");

    expect(push).not.toHaveBeenCalled();
  });

  it("resets the highlight when the query changes", async () => {
    const user = userEvent.setup();
    await montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.type(campo, "o");
    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");

    await user.type(campo, "l");
    expect(campo).not.toHaveAttribute("aria-activedescendant");
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
});

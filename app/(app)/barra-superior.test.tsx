import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarraSuperior } from "./barra-superior";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const listarConciliacoes = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  AVISOS: [
    {
      id: "a1",
      titulo: "Extrato de outubro disponível no banco",
      texto: "O Sicredi liberou o arquivo do período 01–31/10.",
      quando: "há 20 minutos",
      tom: "atencao",
      href: "/conciliacoes/nova",
    },
    {
      id: "a2",
      titulo: "157 divergências aguardando decisão",
      texto: "Setembro não pode ser fechado enquanto houver item pendente.",
      quando: "há 3 horas",
      tom: "risco",
      href: null,
    },
  ],
  listarConciliacoes: () => listarConciliacoes(),
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

const conciliacoes = [
  {
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
];

function montar(props: Partial<Parameters<typeof BarraSuperior>[0]> = {}) {
  return render(
    <BarraSuperior avisoNaoLido={false} onMarcarAvisosLidos={vi.fn()} {...props} />,
  );
}

describe("BarraSuperior", () => {
  beforeEach(() => {
    listarConciliacoes.mockReset();
    listarConciliacoes.mockReturnValue(conciliacoes);
    push.mockReset();
    window.localStorage.clear();
  });

  it("leaves the account and the theme to the side menu", () => {
    montar();
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tema/ })).not.toBeInTheDocument();
  });

  it("shows no results panel until something is typed", () => {
    montar();
    expect(screen.queryByText("Boleto Aço Norte Bobinas")).not.toBeInTheDocument();
  });

  it("finds a lançamento by description", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");

    const achado = screen.getByRole("option", { name: /Boleto Aço Norte Bobinas/ });
    expect(achado).toHaveAttribute("href", "/conciliacoes/conc-1/lc-1");
    expect(screen.queryByText("Folha de pagamento setembro")).not.toBeInTheDocument();
  });

  it("finds a lançamento by its value", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "48.200");

    expect(screen.getByRole("option", { name: /Folha de pagamento setembro/ })).toBeInTheDocument();
  });

  it("finds a lançamento by date", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "04/09");

    expect(screen.getByRole("option", { name: /Boleto Aço Norte Bobinas/ })).toBeInTheDocument();
  });

  it("explains an empty result instead of showing a blank panel", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "xpto");

    expect(screen.getByText(/Nada encontrado/)).toBeInTheDocument();
  });

  it("closes the search panel on Escape", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço");
    expect(screen.getByRole("option", { name: /Boleto Aço Norte/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option", { name: /Boleto Aço Norte/ })).not.toBeInTheDocument();
  });

  it("focuses the search box on the announced shortcut", async () => {
    const user = userEvent.setup();
    montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    expect(campo).not.toHaveFocus();
    await user.keyboard("{Control>}k{/Control}");
    expect(campo).toHaveFocus();
  });

  it("announces itself as a combobox driving the results list", async () => {
    const user = userEvent.setup();
    montar();
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
    montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.type(campo, "a");
    const opcoes = screen.getAllByRole("option");
    expect(campo).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");
    expect(opcoes[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-1");

    // volta ao primeiro dando a volta
    await user.keyboard("{ArrowUp}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");
    await user.keyboard("{ArrowUp}");
    expect(campo).toHaveAttribute(
      "aria-activedescendant",
      `busca-opcao-${opcoes.length - 1}`,
    );
  });

  it("opens the highlighted result with Enter", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/conciliacoes/conc-1/lc-1");
  });

  it("does nothing on Enter while no result is highlighted", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");
    await user.keyboard("{Enter}");

    expect(push).not.toHaveBeenCalled();
  });

  it("resets the highlight when the query changes", async () => {
    const user = userEvent.setup();
    montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    await user.type(campo, "a");
    await user.keyboard("{ArrowDown}");
    expect(campo).toHaveAttribute("aria-activedescendant", "busca-opcao-0");

    await user.type(campo, "ço");
    expect(campo).not.toHaveAttribute("aria-activedescendant");
  });

  it("counts the avisos only while they are unread", () => {
    const { unmount } = montar({ avisoNaoLido: true });
    expect(screen.getByRole("button", { name: "Avisos 2" })).toBeInTheDocument();
    unmount();

    montar({ avisoNaoLido: false });
    expect(screen.getByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
  });

  it("opens the avisos panel and links only the ones with a destination", async () => {
    const user = userEvent.setup();
    montar({ avisoNaoLido: true });

    await user.click(screen.getByRole("button", { name: /Avisos/ }));

    expect(
      screen.getByRole("link", { name: /Extrato de outubro disponível no banco/ }),
    ).toHaveAttribute("href", "/conciliacoes/nova");
    expect(screen.getByText("157 divergências aguardando decisão")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /157 divergências aguardando decisão/ }),
    ).not.toBeInTheDocument();
  });

  it("reports the read action upwards", async () => {
    const onMarcarAvisosLidos = vi.fn();
    const user = userEvent.setup();
    montar({ avisoNaoLido: true, onMarcarAvisosLidos });

    await user.click(screen.getByRole("button", { name: /Avisos/ }));
    await user.click(screen.getByRole("button", { name: "Marcar como lidos" }));

    expect(onMarcarAvisosLidos).toHaveBeenCalled();
  });
});

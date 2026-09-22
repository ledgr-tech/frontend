import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BarraSuperior } from "./barra-superior";

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
        status: "divergencia_valor",
        explicacao: null,
        historico: [],
      },
      {
        id: "lc-2",
        descricao: "Folha de pagamento setembro",
        data: "05/09",
        valorBanco: 48200,
        valorSistema: 48200,
        status: "batido",
        explicacao: null,
        historico: [],
      },
    ],
  },
];

function montar(props: Partial<Parameters<typeof BarraSuperior>[0]> = {}) {
  return render(
    <BarraSuperior
      email="financeiro@telhacerta.com.br"
      avisoNaoLido={false}
      onMarcarAvisosLidos={vi.fn()}
      onSair={vi.fn()}
      {...props}
    />,
  );
}

describe("BarraSuperior", () => {
  beforeEach(() => {
    listarConciliacoes.mockReset();
    listarConciliacoes.mockReturnValue(conciliacoes);
  });

  it("derives the user label and initials from the session email", () => {
    montar();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText("FI")).toBeInTheDocument();
  });

  it("shows no results panel until something is typed", () => {
    montar();
    expect(screen.queryByText("Boleto Aço Norte Bobinas")).not.toBeInTheDocument();
  });

  it("finds a lançamento by description", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "aço norte");

    const achado = screen.getByRole("link", { name: /Boleto Aço Norte Bobinas/ });
    expect(achado).toHaveAttribute("href", "/conciliacoes/conc-1/lc-1");
    expect(screen.queryByText("Folha de pagamento setembro")).not.toBeInTheDocument();
  });

  it("finds a lançamento by its value", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "48.200");

    expect(screen.getByRole("link", { name: /Folha de pagamento setembro/ })).toBeInTheDocument();
  });

  it("finds a lançamento by date", async () => {
    const user = userEvent.setup();
    montar();

    await user.type(screen.getByLabelText("Buscar lançamento"), "04/09");

    expect(screen.getByRole("link", { name: /Boleto Aço Norte Bobinas/ })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Boleto Aço Norte/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: /Boleto Aço Norte/ })).not.toBeInTheDocument();
  });

  it("focuses the search box on the announced shortcut", async () => {
    const user = userEvent.setup();
    montar();
    const campo = screen.getByLabelText("Buscar lançamento");

    expect(campo).not.toHaveFocus();
    await user.keyboard("{Control>}k{/Control}");
    expect(campo).toHaveFocus();
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

  it("reports the logout upwards", async () => {
    const onSair = vi.fn();
    const user = userEvent.setup();
    montar({ onSair });

    await user.click(screen.getByRole("button", { name: "Sair" }));

    expect(onSair).toHaveBeenCalled();
  });
});

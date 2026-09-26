import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { ListaExecucoes, Resultado } from "../conciliacoes/acoes";
import HistoricoPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const listarExecucoes = vi.fn<(pagina?: number) => Promise<Resultado<ListaExecucoes>>>();
vi.mock("../conciliacoes/acoes", () => ({
  listarExecucoes: (pagina?: number) => listarExecucoes(pagina),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

function execucao(parcial: Partial<Execucao> & Pick<Execucao, "id">): Execucao {
  return {
    extratoBancoId: `banco-${parcial.id}`,
    extratoSistemaId: `sistema-${parcial.id}`,
    arquivoBanco: `sicredi-${parcial.id}.ofx`,
    arquivoSistema: `erp-${parcial.id}.csv`,
    executadaEm: "2026-09-24T17:02:11Z",
    lancamentos: 100,
    acerto: 90,
    divergencias: {},
    toleranciaDias: 1,
    atual: true,
    ...parcial,
  };
}

// da mais recente para a mais antiga, como o backend devolve
const EXECUCOES: Execucao[] = [
  execucao({ id: "e3", executadaEm: "2026-09-24T17:02:11Z", lancamentos: 4218, acerto: 96.3 }),
  execucao({ id: "e2", executadaEm: "2026-09-23T12:41:00Z", acerto: 94, atual: false }),
  execucao({ id: "e1", executadaEm: "2026-09-02T19:20:00Z", acerto: 91.8 }),
];

function com(execucoes: Execucao[], total = execucoes.length) {
  listarExecucoes.mockResolvedValue({ ok: true, dados: { execucoes, total, porPagina: 50 } });
}

function props(pagina?: string) {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(pagina === undefined ? {} : { pagina }),
  } as PageProps<"/historico">;
}

async function renderizar(pagina?: string) {
  render(await HistoricoPage(props(pagina)));
}

function eventos() {
  return screen.getAllByRole("listitem").filter((item) => item.classList.contains("hist-evento"));
}

describe("HistoricoPage", () => {
  beforeEach(() => {
    listarExecucoes.mockReset();
    redirect.mockClear();
  });

  it("headlines the most recent taxa de match", async () => {
    com(EXECUCOES);
    await renderizar();
    expect(screen.getByText("Histórico de conciliações")).toBeInTheDocument();
    expect(screen.getByText("96,3% em 24/09")).toBeInTheDocument();
  });

  it("derives the change from the oldest bar to the newest", async () => {
    com(EXECUCOES);
    await renderizar();
    // 96,3 em 24/09 contra 91,8 em 02/09
    expect(screen.getByText("Subiu 4,5 pontos desde 02/09.")).toBeInTheDocument();
  });

  it("says when the rate went down", async () => {
    com([execucao({ id: "e2", acerto: 80 }), execucao({ id: "e1", acerto: 90, executadaEm: "2026-09-02T19:20:00Z" })]);
    await renderizar();
    expect(screen.getByText("Caiu 10,0 pontos desde 02/09.")).toBeInTheDocument();
  });

  it("has nothing to compare with a single execution", async () => {
    com([execucao({ id: "e1", acerto: 90 })]);
    await renderizar();
    expect(screen.queryByText(/pontos desde/)).not.toBeInTheDocument();
  });

  it("draws one bar per execution, oldest first", async () => {
    com(EXECUCOES);
    await renderizar();
    const colunas = document.querySelectorAll(".hist-barra-coluna");
    expect(colunas).toHaveLength(3);
    expect(colunas[0].textContent).toContain("02/09");
    expect(colunas[2].textContent).toContain("24/09");
  });

  it("puts every execution on the timeline, grouped by the month it ran", async () => {
    com([
      ...EXECUCOES,
      execucao({ id: "e0", executadaEm: "2026-08-28T12:00:00Z", acerto: 88 }),
    ]);
    await renderizar();

    const meses = screen.getAllByRole("heading", { level: 3 });
    expect(meses.map((mes) => mes.textContent)).toEqual([
      "Setembro de 20263 execuções",
      "Agosto de 20261 execução",
    ]);
    const [recente] = eventos();
    expect(recente).toHaveTextContent("24/09/2026 14:02");
    expect(recente).toHaveTextContent("sicredi-e3.ofx");
    expect(recente).toHaveTextContent("erp-e3.csv");
    expect(recente).toHaveTextContent("4.218 lançamentos · 96,3% de match · tolerância de 1 dia");
    expect(within(recente).getByText("Atual")).toBeInTheDocument();
    expect(within(recente).getByRole("link", { name: "Ver" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e3?sistema=sistema-e3",
    );
  });

  it("splits each execution into what matched and what asked for review", async () => {
    com([
      execucao({
        id: "e1",
        lancamentos: 140,
        divergencias: { divergente_valor: 7, duplicado: 7, sem_correspondencia: 14, tarifa_bancaria: 7 },
      }),
    ]);
    await renderizar();

    const [evento] = eventos();
    expect(evento).toHaveTextContent("105 conciliados · 35 para revisar");
    const barra = evento.querySelector(".hist-evento-barra")!;
    expect([...barra.children].map((parte) => parte.getAttribute("title"))).toEqual([
      "Conciliados: 105",
      "Custam dinheiro: 14",
      "Incompletos: 14",
      "Já explicados: 7",
    ]);
  });

  it("marks the executions redone later, and says their link opens the current result", async () => {
    com(EXECUCOES);
    await renderizar();

    const refeita = eventos()[1];
    expect(refeita).toHaveAttribute("data-atual", "false");
    expect(within(refeita).getByText("Substituída")).toBeInTheDocument();
    // o backend só guarda a rodada mais nova de cada par: o link não pode
    // prometer as contagens de 23/09 que a entrada mostra
    expect(within(refeita).getByRole("link", { name: "Ver atual" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e2?sistema=sistema-e2",
    );
    expect(screen.getByText(/Só o resultado mais recente fica guardado/)).toBeInTheDocument();
  });

  it("does not explain Ver atual when no execution was redone", async () => {
    com(EXECUCOES.filter((item) => item.atual));
    await renderizar();
    expect(screen.queryByText(/Só o resultado mais recente fica guardado/)).not.toBeInTheDocument();
  });

  it("filters the current and the redone executions", async () => {
    const user = userEvent.setup();
    com(EXECUCOES);
    await renderizar();

    await user.click(screen.getByRole("button", { name: "Substituídas (1)" }));
    expect(eventos()).toHaveLength(1);
    expect(eventos()[0]).toHaveTextContent("sicredi-e2.ofx");

    await user.click(screen.getByRole("button", { name: "Atuais (2)" }));
    expect(eventos()).toHaveLength(2);
  });

  it("sums up only the current executions, since a redone one is replaced", async () => {
    com(EXECUCOES);
    await renderizar();
    const resumo = document.querySelector(".hist-resumo")!;
    expect(within(resumo as HTMLElement).getByText("Conciliações atuais").nextSibling).toHaveTextContent("2");
    // e3 (4.218) + e1 (100)
    expect(within(resumo as HTMLElement).getByText("Lançamentos processados").nextSibling).toHaveTextContent("4.318");
  });

  it("leaves the match out for an execution without lançamentos", async () => {
    com([execucao({ id: "e1", acerto: null, lancamentos: 0 })]);
    await renderizar();
    const [evento] = eventos();
    expect(evento).toHaveTextContent("0 lançamentos · tolerância de 1 dia");
    expect(evento.querySelector(".hist-evento-barra")).toBeNull();
  });

  it("does not show the savings block, which has no data behind it", async () => {
    com(EXECUCOES);
    await renderizar();
    expect(screen.queryByText("Economia acumulada")).not.toBeInTheDocument();
  });

  it("pages through the backend's executions", async () => {
    com(EXECUCOES, 120);
    await renderizar("1");

    expect(listarExecucoes).toHaveBeenCalledWith(1);
    expect(screen.getByText("51–53 de 120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mais recentes" })).toHaveAttribute("href", "/historico");
    expect(screen.getByRole("link", { name: "Mais antigas" })).toHaveAttribute("href", "/historico?pagina=2");
    expect(screen.getByText("Somando as execuções desta página.")).toBeInTheDocument();
  });

  it("starts from the first page when the page in the URL makes no sense", async () => {
    com(EXECUCOES);
    await renderizar("-3");
    expect(listarExecucoes).toHaveBeenCalledWith(0);
    expect(screen.queryByRole("navigation", { name: "Páginas do histórico" })).not.toBeInTheDocument();
  });

  it("offers to go back to the newest when a page past the end comes empty", async () => {
    com([], 3);
    await renderizar("9");
    expect(screen.getByRole("link", { name: "Ir para as mais recentes" })).toHaveAttribute("href", "/historico");
  });

  it("invites the first upload when there is no execution yet", async () => {
    com([]);
    await renderizar();
    expect(screen.getByText("Nenhuma conciliação ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.queryByRole("button", { name: /Exportar histórico/ })).not.toBeInTheDocument();
  });

  it("asks for a reload when the backend fails", async () => {
    listarExecucoes.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    await renderizar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o histórico. Recarregue a página e tente de novo.",
    );
  });

  it("sends an expired session back to the login", async () => {
    listarExecucoes.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(HistoricoPage(props())).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

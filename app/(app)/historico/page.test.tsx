import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Execucao } from "@/lib/adaptadores";
import type { ListaExecucoes, Resultado } from "../conciliacoes/acoes";
import HistoricoPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const listarExecucoes = vi.fn<() => Promise<Resultado<ListaExecucoes>>>();
vi.mock("../conciliacoes/acoes", () => ({
  listarExecucoes: () => listarExecucoes(),
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
  listarExecucoes.mockResolvedValue({ ok: true, dados: { execucoes, total } });
}

async function renderizar() {
  render(await HistoricoPage());
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

  it("lists every execution, marking the ones redone later", async () => {
    com(EXECUCOES);
    await renderizar();

    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(3);
    const recente = within(linhas[0]);
    expect(recente.getByText("24/09/2026 14:02")).toBeInTheDocument();
    expect(recente.getByText("sicredi-e3.ofx × erp-e3.csv")).toBeInTheDocument();
    expect(recente.getByText("4.218")).toBeInTheDocument();
    expect(recente.getByText("96,3%")).toBeInTheDocument();
    expect(recente.getByText("Atual")).toBeInTheDocument();
    expect(recente.getByRole("link", { name: "Ver" })).toHaveAttribute("href", "/conciliacoes/banco-e3");
    expect(within(linhas[1]).getByText("Substituída")).toBeInTheDocument();
  });

  it("shows a dash for an execution without lançamentos", async () => {
    com([execucao({ id: "e1", acerto: null, lancamentos: 0 })]);
    await renderizar();
    expect(within(screen.getAllByRole("row")[1]).getByText("—")).toBeInTheDocument();
  });

  it("does not show the savings block, which has no data behind it", async () => {
    com(EXECUCOES);
    await renderizar();
    expect(screen.queryByText("Economia acumulada")).not.toBeInTheDocument();
  });

  it("says how many are shown when the backend has more", async () => {
    com(EXECUCOES, 120);
    await renderizar();
    expect(screen.getByText("Mostrando as 3 mais recentes de 120.")).toBeInTheDocument();
  });

  it("invites the first upload when there is no execution yet", async () => {
    com([]);
    await renderizar();
    expect(screen.getByText("Nenhuma conciliação ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
    await expect(HistoricoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

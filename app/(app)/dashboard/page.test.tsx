import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { StatusLinha } from "@/lib/mock-data";
import type { ListaDeConciliacoes, Resultado } from "../conciliacoes/acoes";
import type { ConciliacaoNaLista } from "./lista";
import DashboardPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarConciliacoes = vi.fn<() => Promise<Resultado<ListaDeConciliacoes>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarConciliacoes: () => carregarConciliacoes(),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

function conciliacao(
  id: string,
  parcial: {
    competencia?: string;
    rodada?: number;
    rodadas?: number;
    lancamentos?: number;
    divergencias?: Partial<Record<StatusLinha, number>>;
    justificadas?: number;
  } = {},
): ConciliacaoNaLista {
  const execucao: Execucao = {
    id: `e-${id}`,
    extratoBancoId: id,
    extratoSistemaId: `s-${id}`,
    arquivoBanco: `sicredi-${id}.ofx`,
    arquivoSistema: `erp-${id}.csv`,
    executadaEm: "2026-09-24T17:02:11Z",
    lancamentos: parcial.lancamentos ?? 22,
    acerto: 50,
    divergencias: parcial.divergencias ?? {},
    toleranciaDias: 2,
    atual: true,
    justificadas: parcial.justificadas ?? 0,
    periodoInicio: null,
  };
  return {
    extratoBancoId: id,
    extratoSistemaId: execucao.extratoSistemaId,
    arquivoBanco: execucao.arquivoBanco,
    arquivoSistema: execucao.arquivoSistema,
    competencia: parcial.competencia ?? "2026-09",
    rodada: parcial.rodada ?? 1,
    rodadas: parcial.rodadas ?? 1,
    execucao,
  };
}

// setembro em duas rodadas, com 10 divergências (1 justificada); agosto sem pendência
const SETEMBRO = conciliacao("set", {
  rodada: 2,
  rodadas: 2,
  divergencias: { divergente_valor: 6, sem_correspondencia: 4 },
  justificadas: 1,
});
const AGOSTO = conciliacao("ago", { competencia: "2026-08", lancamentos: 100 });

function com(dados: Partial<ListaDeConciliacoes> = {}) {
  carregarConciliacoes.mockResolvedValue({
    ok: true,
    dados: {
      conciliacoes: [SETEMBRO, AGOSTO],
      emAndamento: { extratoBancoId: "set", batem: 12, pedemDecisao: 9, justificadas: 1, conferidas: 3 },
      parcial: false,
      ...dados,
    },
  });
}

async function renderizar() {
  render(await DashboardPage());
}

/** As linhas da lista, na ordem da tela. */
function linhas() {
  return [...document.querySelectorAll<HTMLElement>("tr.conc-linha")];
}

describe("DashboardPage", () => {
  beforeEach(() => {
    carregarConciliacoes.mockReset();
    redirect.mockClear();
  });

  it("is titled like the menu, and counts the conciliações and what still asks for a decision", async () => {
    com();
    await renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Conciliações" })).toBeInTheDocument();
    expect(screen.getByText("2 conciliações · 1 com pendência")).toBeInTheDocument();
  });

  it("puts the conciliação in progress on top, with what is left and a way back to the comparison", async () => {
    com();
    await renderizar();

    const andamento = screen.getByRole("region", { name: "Em andamento" });
    expect(andamento).toHaveTextContent("sicredi-set.ofx");
    expect(andamento).toHaveTextContent("erp-set.csv · setembro de 2026");
    expect(andamento).toHaveTextContent("Rodada 2 de 2");
    expect(andamento).toHaveTextContent("12 batem · 9 pedem decisão · 3 de 9 conferidas · 1 justificada");
    // pelo endereço só do banco, que abre a rodada que vale
    expect(within(andamento).getByRole("link", { name: "Continuar na comparação" })).toHaveAttribute(
      "href",
      "/conciliacoes/set",
    );
  });

  it("leaves the checks out when the backend does not keep them", async () => {
    com({ emAndamento: { extratoBancoId: "set", batem: 12, pedemDecisao: 9, justificadas: 1, conferidas: null } });
    await renderizar();
    expect(screen.getByRole("region", { name: "Em andamento" })).toHaveTextContent(
      "12 batem · 9 pedem decisão · 1 justificada",
    );
    expect(screen.queryByText(/conferidas/)).not.toBeInTheDocument();
  });

  it("says so when nothing asks for a decision, pointing to the most recent", async () => {
    com({ conciliacoes: [AGOSTO], emAndamento: null });
    await renderizar();
    const andamento = screen.getByRole("region", { name: "Em andamento" });
    expect(andamento).toHaveTextContent("Nenhuma conciliação pede decisão.");
    expect(within(andamento).getByRole("link", { name: "Ver a comparação" })).toHaveAttribute(
      "href",
      "/conciliacoes/ago",
    );
  });

  it("lists one row per conciliação, the open ones first, and opens on them", async () => {
    const user = userEvent.setup();
    com();
    await renderizar();

    expect(screen.getByRole("button", { name: "Com pendência (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(linhas()).toHaveLength(1);
    const [setembro] = linhas();
    expect(setembro.querySelector(".conc-c-mes")).toHaveTextContent("set/2026");
    expect(setembro.querySelector(".conc-c-rodada")).toHaveTextContent("2 de 2");
    // 12 de 22: a taxa pelas contagens, como o gráfico e a comparação
    expect(setembro.querySelector(".conc-c-match")).toHaveTextContent("54,5%");
    expect(setembro.querySelector(".conc-c-decisao")).toHaveTextContent("9 · 1 justificada");
    expect(within(setembro).getByText("9 pendências")).toHaveClass("selo", "selo-risco");
    expect(within(setembro).getByRole("link", { name: "Continuar sicredi-set.ofx" })).toHaveAttribute(
      "href",
      "/conciliacoes/set",
    );

    await user.click(screen.getByRole("button", { name: "Todas (2)" }));
    expect(linhas()).toHaveLength(2);
    const agosto = linhas()[1];
    expect(within(agosto).getByText("Sem pendência")).toHaveClass("selo", "selo-ok");
    expect(within(agosto).getByRole("link", { name: "Ver sicredi-ago.ofx" })).toHaveAttribute("href", "/conciliacoes/ago");
  });

  it("opens on all of them when nothing is pending", async () => {
    com({ conciliacoes: [AGOSTO], emAndamento: null });
    await renderizar();
    expect(screen.getByRole("button", { name: "Todas (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(linhas()).toHaveLength(1);
  });

  it("points to the history for the earlier rounds and everything older", async () => {
    com({ parcial: true });
    await renderizar();
    expect(screen.getByRole("link", { name: "Ver o histórico" })).toHaveAttribute("href", "/historico");
    expect(screen.getByText(/as últimas 50 execuções/)).toBeInTheDocument();
  });

  it("shows the empty state when there are no conciliações", async () => {
    com({ conciliacoes: [], emAndamento: null });
    await renderizar();
    expect(screen.getByText("Nenhum extrato por aqui ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fazer o primeiro upload" })).toHaveAttribute("href", "/conciliacoes/nova");
  });

  it("asks for a reload when the backend fails", async () => {
    carregarConciliacoes.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    await renderizar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar suas conciliações. Recarregue a página e tente de novo.",
    );
  });

  it("sends an expired session back to the login", async () => {
    carregarConciliacoes.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(DashboardPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

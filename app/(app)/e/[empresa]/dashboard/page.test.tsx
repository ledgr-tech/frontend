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
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
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
      fechamentos: [],
      emAndamento: { extratoBancoId: "set", batem: 12, pedemDecisao: 9, justificadas: 1, conferidas: 3 },
      parcial: false,
      ...dados,
    },
  });
}

async function renderizar() {
  render(await DashboardPage());
}

/** As folhas da lista, na ordem da tela. */
function folhas() {
  return [...document.querySelectorAll<HTMLElement>("button.conc-folha")];
}

/** A prévia da conciliação escolhida, ao lado das folhas. */
function previa() {
  return screen.getByRole("complementary", { name: "Conciliação escolhida" });
}

describe("DashboardPage", () => {
  beforeEach(() => {
    carregarConciliacoes.mockReset();
    redirect.mockClear();
    push.mockClear();
  });

  it("is titled like the menu, and counts the conciliações and what still asks for a decision", async () => {
    com();
    await renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Conciliações" })).toBeInTheDocument();
    expect(screen.getByText("2 conciliações · 1 pede decisão")).toBeInTheDocument();
  });

  it("leaves a closed month out of what asks for a decision, like the filter below", async () => {
    com({
      fechamentos: [
        {
          competencia: "2026-09",
          estado: "fechado",
          ressalva: "Pendências conhecidas.",
          fechadoPor: "Maria Financeiro",
          fechadoEm: "2026-10-09T16:33:00Z",
          reabertoPor: null,
          reabertoEm: null,
        },
      ],
    });
    await renderizar();
    expect(screen.getByText("2 conciliações")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedem decisão (0)" })).toBeInTheDocument();
  });

  it("opens the first in the queue in the preview, in place of the old continue strip", async () => {
    com();
    await renderizar();

    expect(screen.queryByRole("region", { name: "Continue de onde parou" })).not.toBeInTheDocument();
    const lado = previa();
    expect(lado).toHaveTextContent("Setembro de 2026");
    expect(within(lado).getByRole("heading", { level: 2, name: "9 linhas pedem decisão" })).toBeInTheDocument();
    expect(lado).toHaveTextContent("sicredi-set.ofx");
    expect(lado).toHaveTextContent("× erp-set.csv");
    expect(lado.querySelector(".conc-previa-numero")).toHaveTextContent("12de 22 lançamentos batem");
    // a legenda explica a barra com os mesmos tons do Histórico
    expect(within(lado).getByRole("list", { name: "O que a barra mostra" })).toHaveTextContent(
      "12 · Conciliado6 · Valor diverge, Duplicidade4 · Data diverge, Falta",
    );
    expect(within(lado).getByText("9 pedem decisão")).toHaveClass("selo", "selo-risco");
    // as conferidas só a primeira da fila traz
    expect(lado).toHaveTextContent("Conferidas3 de 9");
    expect(lado).toHaveTextContent("Justificadas1");
    expect(lado).toHaveTextContent("Rodada 2 de 2 · 24/09/2026");
    expect(within(lado).getByRole("link", { name: "Fechamento de setembro" })).toHaveAttribute("href", "/fechamentos?mes=2026-09");
    // pelo endereço só do banco, que abre a rodada que vale
    expect(within(lado).getByRole("link", { name: "Abrir a comparação" })).toHaveAttribute("href", "/conciliacoes/set");
    expect(within(lado).getByRole("button", { name: "Enviar nova versão do extrato do sistema" })).toBeInTheDocument();
  });

  it("leaves the checks out of the preview when the backend does not keep them", async () => {
    com({ emAndamento: { extratoBancoId: "set", batem: 12, pedemDecisao: 9, justificadas: 1, conferidas: null } });
    await renderizar();
    expect(previa()).not.toHaveTextContent("Conferidas");
  });

  it("groups the sheets by month, each with its progress, one situation and its round", async () => {
    const user = userEvent.setup();
    com();
    await renderizar();

    // abre no que pede trabalho
    expect(screen.getByRole("button", { name: "Pedem decisão (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(folhas()).toHaveLength(1);
    const [setembro] = folhas();
    expect(setembro).toHaveAccessibleName(expect.stringContaining("sicredi-set.ofx × erp-set.csv"));
    expect(setembro).toHaveAttribute("aria-pressed", "true");
    expect(setembro).toHaveTextContent("12 de 22 batem");
    expect(within(setembro).getByText("9 pedem decisão")).toHaveClass("selo", "selo-risco");
    expect(setembro).toHaveTextContent("Rodada 2 de 2");

    await user.click(screen.getByRole("button", { name: "Todas (2)" }));
    const meses = screen.getAllByRole("heading", { level: 2 }).filter((titulo) => titulo.classList.contains("conc-mes-titulo"));
    expect(meses.map((titulo) => titulo.textContent)).toEqual(["Setembro de 2026", "Agosto de 2026"]);
    expect(meses[0].parentElement).toHaveTextContent("Aberto · 1 conciliação · 9 linhas pedem decisão");
    expect(within(folhas()[1]).getByText("Sem pendência")).toHaveClass("selo", "selo-ok");
  });

  it("swaps the preview when another sheet is chosen, and opens the comparison on a double click", async () => {
    const user = userEvent.setup();
    com();
    await renderizar();
    await user.click(screen.getByRole("button", { name: "Todas (2)" }));

    const agosto = folhas()[1];
    await user.click(agosto);
    expect(agosto).toHaveAttribute("aria-pressed", "true");
    expect(folhas()[0]).toHaveAttribute("aria-pressed", "false");
    const lado = previa();
    expect(lado).toHaveTextContent("Agosto de 2026");
    expect(within(lado).getByRole("heading", { level: 2, name: "Sem pendência" })).toBeInTheDocument();
    // as conferidas são da primeira da fila, não desta
    expect(lado).not.toHaveTextContent("Conferidas");
    expect(within(lado).getByRole("link", { name: "Abrir a comparação" })).toHaveAttribute("href", "/conciliacoes/ago");

    await user.dblClick(agosto);
    expect(push).toHaveBeenCalledWith("/conciliacoes/ago");
  });

  it("falls back to the first sheet in view when the filter hides the chosen one", async () => {
    const user = userEvent.setup();
    com();
    await renderizar();
    await user.click(screen.getByRole("button", { name: "Sem pendência (1)" }));
    expect(folhas()).toHaveLength(1);
    expect(folhas()[0]).toHaveAttribute("aria-pressed", "true");
    expect(previa()).toHaveTextContent("Agosto de 2026");
  });

  it("puts a closed month after the open ones, says who closed it, and offers no new round in it", async () => {
    const user = userEvent.setup();
    com({
      fechamentos: [
        {
          competencia: "2026-08",
          estado: "fechado",
          ressalva: null,
          fechadoPor: "Maria Financeiro",
          fechadoEm: "2026-10-09T16:33:00Z",
          reabertoPor: null,
          reabertoEm: null,
        },
      ],
    });
    await renderizar();

    await user.click(screen.getByRole("button", { name: "Mês fechado (1)" }));
    const [agosto] = folhas();
    expect(within(agosto).getByText("Mês fechado")).toHaveClass("selo");
    expect(screen.getByRole("heading", { level: 2, name: "Agosto de 2026" }).parentElement).toHaveTextContent(
      "Fechado em 09/10/2026 por Maria Financeiro",
    );
    const lado = previa();
    expect(within(lado).getByRole("heading", { level: 2, name: "Mês fechado" })).toBeInTheDocument();
    expect(within(lado).getByRole("link", { name: "Ver o fechamento" })).toHaveAttribute("href", "/fechamentos?mes=2026-08");
    expect(within(lado).queryByRole("button", { name: /nova versão/ })).not.toBeInTheDocument();
  });

  it("opens on all of them when nothing is pending", async () => {
    com({ conciliacoes: [AGOSTO], emAndamento: null });
    await renderizar();
    expect(screen.getByRole("button", { name: "Todas (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(folhas()).toHaveLength(1);
    expect(previa()).toHaveTextContent("Agosto de 2026");
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
    // vazio é um convite: o mascote aponta para quem vai agir
    expect(document.querySelector("img")?.getAttribute("src")).toContain("mascote-explicando");
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

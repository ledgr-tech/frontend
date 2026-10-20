import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { StatusLinha } from "@/lib/mock-data";
import type { ListaDeConciliacoes, Resultado } from "../conciliacoes/acoes";
import type { ConciliacaoNaLista } from "./lista";
import { ProvedorDaColuna, ColunaAgora, useColuna } from "../coluna/coluna";
import { caminhoDoFechamento } from "@/lib/caminhos";
import DashboardPage from "./page";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", redirect: (d: string) => redirectar(d) }));
const redirectar = (d: string) => {
  redirect(d);
  throw new Error("NEXT_REDIRECT");
};

function Espia() {
  return <span data-testid="pendente">{String(useColuna().pendente)}</span>;
}

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarConciliacoes = vi.fn<() => Promise<Resultado<ListaDeConciliacoes>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarConciliacoes: () => carregarConciliacoes(),
}));

const redirect = vi.fn();

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
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  const pagina = await DashboardPage();
  render(
    <ProvedorDaColuna>
      <ColunaAgora />
      <Espia />
      {pagina}
    </ProvedorDaColuna>,
  );
}

/** O "Agora" que a tela pôs na coluna. */
function agora() {
  return document.querySelector<HTMLElement>(".coluna-agora-corpo")!;
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
    expect(screen.getByText("2 conciliações · 1 pede decisão")).toBeInTheDocument();
  });

  it("offers to continue where it stopped in one line, instead of repeating the first row in a big card", async () => {
    com();
    await renderizar();

    const continuar = screen.getByRole("region", { name: "Continue de onde parou" });
    expect(agora()).toContainElement(continuar);
    expect(screen.getByTestId("pendente")).toHaveTextContent("true");
    expect(continuar).toHaveTextContent("Setembro de 2026");
    expect(continuar).toHaveTextContent("sicredi-set.ofx × erp-set.csv");
    expect(continuar).toHaveTextContent("9 linhas pedem decisão · 3 de 9 conferidas · rodada 2 de 2");
    expect(continuar.querySelector("img")?.getAttribute("src")).toContain("mascote-caminhando");
    // pelo endereço só do banco, que abre a rodada que vale
    expect(within(continuar).getByRole("link", { name: "Continuar" })).toHaveAttribute("href", "/conciliacoes/set");
  });

  it("leaves the checks out of the line when the backend does not keep them", async () => {
    com({ emAndamento: { extratoBancoId: "set", batem: 12, pedemDecisao: 9, justificadas: 1, conferidas: null } });
    await renderizar();
    expect(screen.getByRole("region", { name: "Continue de onde parou" })).toHaveTextContent(
      "9 linhas pedem decisão · rodada 2 de 2",
    );
    expect(screen.queryByText(/conferidas/)).not.toBeInTheDocument();
  });

  it("has nothing to continue when nothing asks for a decision", async () => {
    com({ conciliacoes: [AGOSTO], emAndamento: null });
    await renderizar();
    expect(screen.queryByRole("region", { name: "Continue de onde parou" })).not.toBeInTheDocument();
  });

  it("says which month is ready to close when nothing is pending, linking where the list does", async () => {
    com({ conciliacoes: [AGOSTO], emAndamento: null });
    await renderizar();
    expect(screen.getByTestId("pendente")).toHaveTextContent("false");
    expect(within(agora()).getByRole("link", { name: "Fechamento de agosto" })).toHaveAttribute(
      "href",
      caminhoDoFechamento("2026-08"),
    );
  });

  it("offers a new conciliação when nothing is pending and no month is ready", async () => {
    com({ conciliacoes: [AGOSTO], emAndamento: null, fechamentos: [{
      competencia: "2026-08", estado: "fechado", ressalva: null, fechadoPor: "M", fechadoEm: "2026-10-09T16:33:00Z", reabertoPor: null, reabertoEm: null,
    }] });
    await renderizar();
    expect(within(agora()).getByRole("link", { name: "Nova conciliação" })).toHaveAttribute("href", "/conciliacoes/nova");
    expect(within(agora()).queryByRole("link", { name: /Fechamento de/ })).not.toBeInTheDocument();
  });

  it("groups the rows by month, each row with one situation, its progress and its last activity", async () => {
    const user = userEvent.setup();
    com();
    await renderizar();

    // abre no que pede trabalho
    expect(screen.getByRole("button", { name: "Pedem decisão (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(linhas()).toHaveLength(1);
    const [setembro] = linhas();
    expect(within(setembro).getByRole("link", { name: /sicredi-set\.ofx/ })).toHaveAttribute("href", "/conciliacoes/set");
    expect(setembro).toHaveTextContent("× erp-set.csv");
    // 12 de 22: o que bateu, e a justificada à parte; sem a taxa repetida em número
    expect(setembro.querySelector(".conc-c-progresso")).toHaveTextContent("12 de 22 batem · 1 justificada");
    expect(within(setembro).getByText("9 pedem decisão")).toHaveClass("selo", "selo-risco");
    expect(setembro.querySelector(".conc-c-atividade")).toHaveTextContent("Rodada 2 de 2");

    await user.click(screen.getByRole("button", { name: "Todas (2)" }));
    const grupos = screen.getAllByRole("rowgroup").filter((grupo) => grupo.tagName === "TBODY");
    expect(grupos.map((grupo) => within(grupo).getByRole("rowheader").textContent)).toEqual([
      expect.stringContaining("Setembro de 2026"),
      expect.stringContaining("Agosto de 2026"),
    ]);
    expect(within(grupos[0]).getByRole("rowheader")).toHaveTextContent("Aberto · 1 conciliação · 9 linhas pedem decisão");
    expect(within(grupos[0]).getByRole("link", { name: "Fechamento de setembro" })).toHaveAttribute(
      "href",
      "/fechamentos?mes=2026-09",
    );
    expect(within(linhas()[1]).getByText("Sem pendência")).toHaveClass("selo", "selo-ok");
  });

  it("puts a closed month after the open ones, says who closed it, and its rows as month closed", async () => {
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
    const [agosto] = linhas();
    expect(within(agosto).getByText("Mês fechado")).toHaveClass("selo");
    const grupo = agosto.closest("tbody")!;
    expect(within(grupo).getByRole("rowheader")).toHaveTextContent("Fechado em 09/10/2026 por Maria Financeiro");
    expect(within(grupo).getByRole("link", { name: "Ver o fechamento" })).toHaveAttribute("href", "/fechamentos?mes=2026-08");
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

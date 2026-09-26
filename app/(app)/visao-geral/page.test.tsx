import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Execucao } from "@/lib/adaptadores";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import type { Resultado, VisaoGeral } from "../conciliacoes/acoes";
import VisaoGeralPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarVisaoGeral = vi.fn<() => Promise<Resultado<VisaoGeral>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarVisaoGeral: () => carregarVisaoGeral(),
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
    lancamentos: 6,
    acerto: 50,
    divergencias: {},
    atual: true,
    ...parcial,
  };
}

function linha(
  id: string,
  status: StatusLinha,
  valorBanco: number | null,
  valorSistema: number | null,
): LinhaComparacao {
  return {
    id,
    descricao: `Lançamento ${id}`,
    data: "04/09",
    dataISO: "2026-09-04",
    valorBanco,
    valorSistema,
    status,
    explicacao: null,
    historico: [],
  };
}

const RECENTE = execucao({ id: "e7", executadaEm: "2026-09-24T17:02:11Z" });

// da mais recente para a mais antiga, como o backend devolve
const EXECUCOES: Execucao[] = [
  RECENTE,
  execucao({ id: "e6", executadaEm: "2026-09-23T12:41:00Z", acerto: 48, atual: false }),
  execucao({ id: "e5", executadaEm: "2026-09-02T19:20:00Z", acerto: 91.8 }),
  execucao({ id: "e4", executadaEm: "2026-08-05T13:00:00Z", acerto: 88 }),
  execucao({ id: "e3", executadaEm: "2026-07-04T13:00:00Z", acerto: 86 }),
  execucao({ id: "e2", executadaEm: "2026-06-04T13:00:00Z", acerto: 84 }),
  execucao({ id: "e1", executadaEm: "2026-05-04T13:00:00Z", acerto: 80 }),
];

const LINHAS: LinhaComparacao[] = [
  linha("l1", "match_exato", 100, 100),
  linha("l2", "match_exato", 200, 200),
  linha("l3", "match_tolerancia", 300, 300),
  linha("l4", "sem_correspondencia", 4180, null),
  linha("l5", "divergente_valor", -12640, -12604),
  linha("l6", "tarifa_bancaria", -45, null),
];

function com(visao: Partial<VisaoGeral> = {}) {
  carregarVisaoGeral.mockResolvedValue({
    ok: true,
    dados: {
      execucoes: EXECUCOES,
      total: EXECUCOES.length,
      recente: {
        execucao: RECENTE,
        conciliacao: {
          id: "banco-e7",
          extratoSistemaId: "sistema-e7",
          mes: "Setembro/2026",
          status: "em_andamento",
          linhas: LINHAS,
        },
      },
      arquivosComLinhasNaoLidas: [],
      ...visao,
    },
  });
}

async function renderizar() {
  render(await VisaoGeralPage());
}

describe("VisaoGeralPage", () => {
  beforeEach(() => {
    carregarVisaoGeral.mockReset();
    redirect.mockClear();
  });

  it("names the screen, the empresa and the competência", async () => {
    com();
    await renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByText("Telha Certa · competência setembro/2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
  });

  it("works as a hub: one shortcut per screen, each with where that screen stands", async () => {
    com();
    await renderizar();

    const atalhos = screen.getByRole("navigation", { name: "Atalhos" });
    const extratos = within(atalhos).getByRole("link", { name: /Extratos/ });
    expect(extratos).toHaveAttribute("href", "/extratos");
    // sete execuções, cada uma com os seus dois arquivos
    expect(extratos).toHaveTextContent("14 arquivos");
    expect(extratos).toHaveTextContent("7 do banco · 7 do sistema");
    expect(extratos).toHaveTextContent("sicredi-e7.ofx");
    expect(extratos).toHaveTextContent("erp-e7.csv");

    // a rodada refeita depois (e6) não conta como outra conciliação
    const conciliacoes = within(atalhos).getByRole("link", { name: /Conciliações/ });
    expect(conciliacoes).toHaveAttribute("href", "/dashboard");
    expect(conciliacoes).toHaveTextContent("6 conciliações");
    expect(conciliacoes).toHaveTextContent("Última em 24/09/2026 14:02");

    const fechamentos = within(atalhos).getByRole("link", { name: /Fechamentos/ });
    expect(fechamentos).toHaveAttribute("href", "/fechamentos");
    expect(fechamentos).toHaveTextContent("Setembro de 2026");
    expect(fechamentos).toHaveTextContent("3 pendências na última conciliação");

    const historico = within(atalhos).getByRole("link", { name: /Histórico/ });
    expect(historico).toHaveAttribute("href", "/historico");
    expect(historico).toHaveTextContent("7 execuções");
    expect(historico).toHaveTextContent("Match de 50,0% na última");
  });

  it("tells the shortcuts about unread lines, and about a latest conciliação with nothing pending", async () => {
    com({ arquivosComLinhasNaoLidas: [{ nome: "erp-e7.csv", linhas: 2 }] });
    await renderizar();
    const atalhos = screen.getByRole("navigation", { name: "Atalhos" });
    expect(within(atalhos).getByRole("link", { name: /Extratos/ })).toHaveTextContent("2 linhas não lidas");

    carregarVisaoGeral.mockReset();
    com({
      recente: {
        execucao: RECENTE,
        conciliacao: {
          id: "banco-e7",
          mes: "Setembro/2026",
          status: "em_andamento",
          linhas: [linha("l1", "match_exato", 100, 100)],
        },
      },
    });
    document.body.innerHTML = "";
    await renderizar();
    expect(
      within(screen.getByRole("navigation", { name: "Atalhos" })).getByRole("link", { name: /Fechamentos/ }),
    ).toHaveTextContent("Última conciliação sem pendência");
  });

  it("says how much of the month is settled, with a progress bar", async () => {
    com();
    await renderizar();

    expect(screen.getByText("3 de 6 lançamentos conciliados")).toBeInTheDocument();
    const barra = screen.getByRole("progressbar", { name: "Lançamentos conciliados" });
    expect(barra).toHaveAttribute("aria-valuenow", "50");
    // 36 de diferença + 4.180 sem par + 45 de tarifa
    expect(screen.getByText("R$ 4.261 em aberto")).toBeInTheDocument();
  });

  it("points to the latest conciliação, with when and which files", async () => {
    com();
    await renderizar();

    expect(
      screen.getByText("Última conciliação em 24/09/2026 14:02 · sicredi-e7.ofx × erp-e7.csv"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver a conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e7?sistema=sistema-e7",
    );
  });

  it("lists what needs attention, riskiest first, each opening its first case", async () => {
    com();
    await renderizar();

    const lista = screen.getByRole("list", { name: "Pede sua atenção" });
    const itens = within(lista).getAllByRole("link");
    expect(itens.map((item) => item.getAttribute("href"))).toEqual([
      "/conciliacoes/banco-e7/l5?sistema=sistema-e7",
      "/conciliacoes/banco-e7/l4?sistema=sistema-e7",
      "/conciliacoes/banco-e7/l6?sistema=sistema-e7",
    ]);
    expect(itens[0]).toHaveTextContent("Valor diverge na mesma data");
    expect(itens[0]).toHaveTextContent("1 lançamento · R$ 36");
    expect(itens[1]).toHaveTextContent("Sem correspondência no sistema");
    expect(itens[1]).toHaveTextContent("1 lançamento · R$ 4.180");
  });

  it("adds the files with lines the parser could not read", async () => {
    com({ arquivosComLinhasNaoLidas: [{ nome: "erp-e7.csv", linhas: 2 }] });
    await renderizar();

    const lista = screen.getByRole("list", { name: "Pede sua atenção" });
    const arquivo = within(lista).getByRole("link", { name: /Linhas não lidas/ });
    expect(arquivo).toHaveTextContent("2 linhas em erp-e7.csv");
    expect(arquivo).toHaveAttribute("href", "/extratos");
  });

  it("says so when nothing is pending", async () => {
    com({
      recente: {
        execucao: RECENTE,
        conciliacao: {
          id: "banco-e7",
          mes: "Setembro/2026",
          status: "em_andamento",
          linhas: [linha("l1", "match_exato", 100, 100)],
        },
      },
    });
    await renderizar();

    expect(screen.getByText("Nada pede sua atenção agora.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Pede sua atenção" })).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum valor em aberto")).toBeInTheDocument();
  });

  it("leaves the amount out when a group has no money open", async () => {
    // mesmo valor em outra data: está tudo lá, só no dia errado
    com({
      recente: {
        execucao: RECENTE,
        conciliacao: {
          id: "banco-e7",
          mes: "Setembro/2026",
          status: "em_andamento",
          linhas: [linha("d1", "divergente_data", 300, 300)],
        },
      },
    });
    await renderizar();

    const item = within(screen.getByRole("list", { name: "Pede sua atenção" })).getByRole("link");
    expect(item).toHaveTextContent("Mesmo valor em outra data");
    expect(item).toHaveTextContent("1 lançamento");
    expect(item.textContent).not.toContain("R$");
    // e o estado não diz "nada em aberto" com um item pedindo revisão logo abaixo
    expect(screen.getByText("Nenhum valor em aberto")).toBeInTheDocument();
  });

  it("draws the match-rate trend of the last six executions", async () => {
    com();
    await renderizar();

    expect(document.querySelectorAll(".hist-barra-coluna")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Ver histórico" })).toHaveAttribute("href", "/historico");
  });

  it("lists the five most recent executions", async () => {
    com();
    await renderizar();

    const tabela = screen.getByRole("table", { name: "Atividade recente" });
    const linhas = within(tabela).getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(5);
    expect(within(linhas[0]).getByText("24/09/2026 14:02")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("sicredi-e7.ofx × erp-e7.csv")).toBeInTheDocument();
    expect(within(linhas[0]).getByRole("link", { name: "Ver" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e7?sistema=sistema-e7",
    );
  });

  it("says a redone execution opens the current result of its pair", async () => {
    com();
    await renderizar();

    const tabela = screen.getByRole("table", { name: "Atividade recente" });
    const refeita = within(tabela).getAllByRole("row")[2];
    // e6 foi refeita: o backend só guarda a rodada mais nova de cada par, e é
    // ela que abre — o link diz isso em vez de fingir que abre a de 23/09
    expect(within(refeita).getByRole("link", { name: "Ver atual" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e6?sistema=sistema-e6",
    );
    expect(screen.getByText(/Só o resultado mais recente fica guardado/)).toBeInTheDocument();
  });

  it("does not explain Ver atual when no recent execution was redone", async () => {
    com({ execucoes: EXECUCOES.filter((item) => item.atual) });
    await renderizar();

    expect(screen.getByRole("table", { name: "Atividade recente" })).toBeInTheDocument();
    expect(screen.queryByText(/Só o resultado mais recente fica guardado/)).not.toBeInTheDocument();
  });

  it("walks through the first steps when there is no conciliação yet", async () => {
    com({ execucoes: [], total: 0, recente: null });
    await renderizar();

    expect(screen.getByText("Nenhum extrato por aqui ainda.")).toBeInTheDocument();
    const passos = screen.getByRole("list", { name: "Primeiros passos" });
    expect(within(passos).getAllByRole("listitem").map((item) => item.querySelector("h3")?.textContent)).toEqual([
      "Suba o extrato do banco",
      "Suba o extrato do sistema de gestão",
      "Revise o que não bateu",
    ]);
    expect(screen.getByRole("link", { name: "Fazer o primeiro upload" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("asks for a reload when the backend fails", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: false,
      status: 0,
      erro: "Não foi possível falar com o servidor.",
    });
    await renderizar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar a visão geral. Recarregue a página e tente de novo.",
    );
  });

  it("sends an expired session back to the login", async () => {
    carregarVisaoGeral.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(VisaoGeralPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

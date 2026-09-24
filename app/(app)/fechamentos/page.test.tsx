import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Execucao } from "@/lib/adaptadores";
import type { Conciliacao, LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import type { Resultado, VisaoGeral } from "../conciliacoes/acoes";
import FechamentosPage from "./page";

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
  execucao({ id: "e6", executadaEm: "2026-09-02T19:20:00Z" }),
  execucao({ id: "e1", executadaEm: "2026-05-04T13:00:00Z", lancamentos: 1219 }),
];

const RESOLVIDAS: LinhaComparacao[] = [
  linha("l1", "match_exato", 100, 100),
  linha("l2", "match_exato", 200, 200),
  linha("l3", "match_tolerancia", 300, 300),
];

const EM_ABERTO: LinhaComparacao[] = [
  ...RESOLVIDAS,
  linha("l4", "sem_correspondencia", 4180, null),
  linha("l5", "divergente_valor", -12640, -12604),
  linha("l6", "tarifa_bancaria", -45, null),
];

function conciliacao(linhas: LinhaComparacao[], mes = "Setembro/2026"): Conciliacao {
  return { id: "banco-e7", extratoSistemaId: "sistema-e7", mes, status: "em_andamento", linhas };
}

function com(linhas: LinhaComparacao[], visao: Partial<VisaoGeral> = {}, mes?: string) {
  carregarVisaoGeral.mockResolvedValue({
    ok: true,
    dados: {
      execucoes: EXECUCOES,
      total: EXECUCOES.length,
      recente: { execucao: RECENTE, conciliacao: conciliacao(linhas, mes) },
      arquivosComLinhasNaoLidas: [],
      ...visao,
    },
  });
}

async function renderizar() {
  render(await FechamentosPage());
}

describe("FechamentosPage", () => {
  beforeEach(() => {
    carregarVisaoGeral.mockReset();
    redirect.mockClear();
  });

  it("names the fechamento after the competência of the latest conciliação", async () => {
    com(EM_ABERTO);
    await renderizar();
    expect(
      screen.getByRole("heading", { level: 1, name: "Fechamento de setembro" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Telha Certa · competência setembro/2026")).toBeInTheDocument();
  });

  it("says the month cannot be closed while items wait for a decision", async () => {
    com(EM_ABERTO);
    await renderizar();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Setembro não pode ser fechado enquanto houver item pendente.",
      }),
    ).toBeInTheDocument();
    const pendentes = screen.getByRole("link", { name: /3 divergências aguardando decisão/ });
    // 36 de diferença + 4.180 sem par + 45 de tarifa
    expect(pendentes).toHaveTextContent("R$ 4.261 em aberto");
    expect(pendentes).toHaveAttribute("href", "/conciliacoes/banco-e7?sistema=sistema-e7");
    expect(screen.queryByText("Mês conciliado")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Começar/ })).not.toBeInTheDocument();
  });

  it("uses the singular for a single pending item", async () => {
    com([...RESOLVIDAS, linha("l5", "divergente_valor", -12640, -12604)]);
    await renderizar();
    expect(
      screen.getByRole("link", { name: /1 divergência aguardando decisão/ }),
    ).toHaveTextContent("R$ 36 em aberto");
  });

  it("leaves the amount out when the pending items have no money open", async () => {
    // mesmo valor em outra data: está tudo lá, só no dia errado
    com([...RESOLVIDAS, linha("d1", "divergente_data", 300, 300)]);
    await renderizar();
    const pendente = screen.getByRole("link", { name: /1 divergência aguardando decisão/ });
    expect(pendente.textContent).not.toContain("R$");
  });

  it("does not call the month conciliado while a file has lines nobody read", async () => {
    com(RESOLVIDAS, { arquivosComLinhasNaoLidas: [{ nome: "erp-e7.csv", linhas: 2 }] });
    await renderizar();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Setembro não pode ser fechado enquanto houver item pendente.",
      }),
    ).toBeInTheDocument();
    const arquivo = screen.getByRole("link", { name: /Linhas não lidas/ });
    expect(arquivo).toHaveTextContent("2 linhas em erp-e7.csv");
    expect(arquivo).toHaveAttribute("href", "/extratos");
    expect(screen.queryByText(/aguardando decisão/)).not.toBeInTheDocument();
    expect(screen.queryByText("Mês conciliado")).not.toBeInTheDocument();
  });

  it("celebrates a month with nothing pending, as the design does", async () => {
    com(RESOLVIDAS);
    await renderizar();

    expect(screen.getByText("Mês conciliado")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Setembro fechou sem divergência pendente." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nada em revisão nesta competência — todos os lançamentos bateram."),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mascote Ledgr comemorando" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver a conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/banco-e7?sistema=sistema-e7",
    );
    expect(screen.getByRole("link", { name: "Começar outubro" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(
      screen.getByText("O extrato de outubro pode ser subido a partir do dia 1º."),
    ).toBeInTheDocument();
  });

  it("starts january after a december competência", async () => {
    com(RESOLVIDAS, {}, "Dezembro/2026");
    await renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Fechamento de dezembro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar janeiro" })).toBeInTheDocument();
  });

  it("falls back to the plain month when the lines carry no date", async () => {
    com([], {}, "Conciliação");
    await renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Fechamentos" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "O mês fechou sem divergência pendente." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar o próximo mês" })).toBeInTheDocument();
    expect(screen.queryByText(/pode ser subido/)).not.toBeInTheDocument();
  });

  it("sums the month up with real numbers only", async () => {
    com(EM_ABERTO);
    await renderizar();

    expect(screen.getByText("Lançamentos").nextElementSibling).toHaveTextContent("6");
    expect(screen.getByText("Resolvidos").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Em aberto").nextElementSibling).toHaveTextContent("R$ 4.261");
    // ajuste líquido e tempo total não têm fonte no backend
    expect(screen.queryByText("Ajuste líquido")).not.toBeInTheDocument();
    expect(screen.queryByText("Tempo total")).not.toBeInTheDocument();
  });

  it("says which conciliação it read, with when and which files", async () => {
    com(EM_ABERTO);
    await renderizar();
    expect(
      screen.getByText("Última conciliação em 24/09/2026 14:02 · sicredi-e7.ofx × erp-e7.csv"),
    ).toBeInTheDocument();
  });

  it("shows the first-conciliação milestone from the oldest execution", async () => {
    com(RESOLVIDAS);
    await renderizar();

    const marcos = screen.getByRole("list", { name: "Marcos conquistados" });
    const [marco, ...outros] = within(marcos).getAllByRole("listitem");
    expect(outros).toHaveLength(0);
    expect(marco).toHaveTextContent("Primeira conciliação");
    expect(marco).toHaveTextContent("Maio de 2026 · 1.219 lançamentos.");
    expect(within(marco).getByText("Conquistado")).toBeInTheDocument();
    // os outros marcos do design (três meses sem ressalva, cem divergências
    // resolvidas) dependem de fechamento e de decisões que o backend não guarda
    expect(screen.queryByText("Três meses sem ressalva")).not.toBeInTheDocument();
    expect(screen.queryByText(/selos da/)).not.toBeInTheDocument();
  });

  it("keeps the milestone without a date when the list stops before the first execution", async () => {
    com(RESOLVIDAS, { total: 120 });
    await renderizar();

    const marco = within(screen.getByRole("list", { name: "Marcos conquistados" })).getByRole(
      "listitem",
    );
    expect(marco).toHaveTextContent("Primeira conciliação");
    expect(marco.textContent).not.toContain("lançamentos.");
  });

  it("does not offer to deliver or close the month, which the backend cannot do yet", async () => {
    com(RESOLVIDAS);
    await renderizar();

    expect(screen.queryByText("Entregar o fechamento")).not.toBeInTheDocument();
    expect(screen.queryByText(/Baixar/)).not.toBeInTheDocument();
    // nada nesta tela grava: tudo o que se clica é link
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("invites the first conciliação when there is none yet", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
    });
    await renderizar();

    expect(screen.getByRole("heading", { level: 1, name: "Fechamentos" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma conciliação ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova conciliação" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.queryByText("Marcos conquistados")).not.toBeInTheDocument();
  });

  it("asks for a reload when the backend fails", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: false,
      status: 0,
      erro: "Não foi possível falar com o servidor.",
    });
    await renderizar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o fechamento. Recarregue a página e tente de novo.",
    );
  });

  it("sends an expired session back to the login", async () => {
    carregarVisaoGeral.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(FechamentosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

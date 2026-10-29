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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
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
    justificadas: 0,
    periodoInicio: null,
    ...parcial,
  };
}

// da mais recente para a mais antiga, como o backend devolve
const EXECUCOES: Execucao[] = [
  execucao({ id: "e3", executadaEm: "2026-09-24T17:02:11Z", lancamentos: 4218, acerto: 96.3 }),
  execucao({ id: "e2", executadaEm: "2026-09-23T12:41:00Z", acerto: 94, atual: false }),
  execucao({ id: "e1", executadaEm: "2026-09-02T19:20:00Z", acerto: 91.8 }),
];

/** Setembro: o extrato B na rodada 2, refeita uma vez, depois da rodada 1; e o A, de uma rodada só. */
const SETEMBRO = { extratoBancoId: "B", arquivoBanco: "sicredi-setembro.ofx" };
const RODADAS: Execucao[] = [
  execucao({
    id: "b3",
    ...SETEMBRO,
    extratoSistemaId: "S2",
    arquivoSistema: "erp-setembro-v2.csv",
    executadaEm: "2026-09-24T17:02:11Z",
    lancamentos: 22,
    // o backend manda 12 de 22 arredondado; a tela conta as linhas
    acerto: 54.55,
    divergencias: { divergente_valor: 10 },
  }),
  execucao({
    id: "b2",
    ...SETEMBRO,
    extratoSistemaId: "S2",
    arquivoSistema: "erp-setembro-v2.csv",
    executadaEm: "2026-09-24T09:10:00Z",
    lancamentos: 12,
    acerto: 41.67,
    divergencias: { divergente_valor: 7 },
    atual: false,
  }),
  execucao({
    id: "b1",
    ...SETEMBRO,
    extratoSistemaId: "S1",
    arquivoSistema: "erp-setembro.csv",
    executadaEm: "2026-09-23T12:41:00Z",
    lancamentos: 3,
    acerto: 33.33,
    divergencias: { sem_correspondencia: 2 },
  }),
  execucao({
    id: "a1",
    extratoBancoId: "A",
    arquivoBanco: "sicredi-agosto.ofx",
    arquivoSistema: "erp-agosto.csv",
    executadaEm: "2026-09-02T19:20:00Z",
    lancamentos: 3980,
    acerto: 100,
  }),
];

/**
 * A página do backend. `meses` é o mês (AAAA-MM) em que o extrato do banco de cada conciliação
 * começa, que vem em cada execução (`periodoInicio`); sem ele, a execução vem sem período.
 */
function com(execucoes: Execucao[], total = execucoes.length, meses: Record<string, string> = {}) {
  const comPeriodo = execucoes.map((item) =>
    meses[item.extratoBancoId] ? { ...item, periodoInicio: `${meses[item.extratoBancoId]}-01` } : item,
  );
  listarExecucoes.mockResolvedValue({ ok: true, dados: { execucoes: comPeriodo, total, porPagina: 50 } });
}

function props(pagina?: string) {
  return {
    params: Promise.resolve({}),
    searchParams: Promise.resolve(pagina === undefined ? {} : { pagina }),
  } as PageProps<"/e/[empresa]/historico">;
}

async function renderizar(pagina?: string) {
  render(await HistoricoPage(props(pagina)));
}

/** A folha de cada conciliação, na ordem da tela. */
function conciliacoes() {
  return [...document.querySelectorAll<HTMLElement>("button.conc-folha")];
}

/** A prévia da conciliação escolhida, ao lado das folhas. */
function previa() {
  return screen.getByRole("complementary", { name: "Conciliação escolhida" });
}

/** O título de cada mês, na ordem da tela. */
function titulosDosMeses() {
  return [...document.querySelectorAll(".conc-mes-titulo")].map((titulo) => titulo.textContent);
}

describe("HistoricoPage", () => {
  beforeEach(() => {
    listarExecucoes.mockReset();
    redirect.mockClear();
  });

  /** 100 lançamentos, `divergentes` deles sem par, numa execução do extrato do banco `banco`. */
  function comTaxa(id: string, banco: string, executadaEm: string, divergentes: number): Execucao {
    return execucao({
      id,
      extratoBancoId: banco,
      executadaEm,
      lancamentos: 100,
      divergencias: divergentes > 0 ? { divergente_valor: divergentes } : {},
    });
  }

  /** O mês e o número de cada ponto do gráfico, do mais antigo ao mais novo. */
  function pontosDoGrafico() {
    const meses = [...document.querySelectorAll(".grafico-fio-meses > span")].map((mes) => mes.textContent);
    const taxas = [...document.querySelectorAll(".grafico-fio-valor")].map((taxa) => taxa.textContent);
    return meses.map((mes, indice) => [mes, taxas[indice]]);
  }

  it("headlines the rate of the most recent month", async () => {
    com([comTaxa("e3", "B", "2026-09-24T17:02:11Z", 4), comTaxa("e1", "A", "2026-08-02T19:20:00Z", 8)]);
    await renderizar();
    expect(screen.getByRole("heading", { level: 1, name: "Histórico" })).toBeInTheDocument();
    expect(screen.getByText("96,0% em setembro")).toBeInTheDocument();
    // de 92% em agosto para 96% em setembro
    expect(screen.getByText("Subiu 4,0 pontos desde agosto.")).toBeInTheDocument();
  });

  it("says when the rate went down", async () => {
    com([comTaxa("e2", "B", "2026-09-24T17:02:11Z", 20), comTaxa("e1", "A", "2026-08-02T19:20:00Z", 10)]);
    await renderizar();
    expect(screen.getByText("Caiu 10,0 pontos desde agosto.")).toBeInTheDocument();
  });

  it("has nothing to compare with a single month", async () => {
    com([comTaxa("e1", "B", "2026-09-24T17:02:11Z", 10)]);
    await renderizar();
    expect(screen.queryByText(/pontos desde/)).not.toBeInTheDocument();
    expect(pontosDoGrafico()).toEqual([["set/26", "90,0%"]]);
  });

  it("draws one point per month of the extrato, summing its conciliações, oldest first", async () => {
    com(
      [
        // o extrato de setembro com a rodada nova em outubro conta em setembro
        comTaxa("s", "B-set", "2026-10-02T12:00:00Z", 10),
        // os dois bancos de agosto juntos: 180 de 200
        comTaxa("a2", "itau-ago", "2026-09-02T12:00:00Z", 0),
        comTaxa("a1", "sicredi-ago", "2026-09-02T11:00:00Z", 20),
      ],
      3,
      { "B-set": "2026-09", "itau-ago": "2026-08", "sicredi-ago": "2026-08" },
    );
    await renderizar();
    expect(pontosDoGrafico()).toEqual([
      ["ago", "90,0%"],
      ["set/26", "90,0%"],
    ]);
    // o mês de agora é o ponto cheio
    const pontos = document.querySelectorAll(".grafico-fio-ponto");
    expect(pontos[1]).toHaveAttribute("data-atual", "true");
    expect(pontos[0]).toHaveAttribute("title", "agosto de 2026 · 90,0% · 180 de 200 lançamentos");
  });

  it("leaves the older round and the redone execution out of the chart, so they don't read as a drop", async () => {
    com(
      RODADAS.map((item) =>
        // a rodada que vale bateu 12 de 22; a refeita e a rodada 1 eram piores
        item.id === "b3"
          ? { ...item, divergencias: { divergente_valor: 10 } }
          : item.id.startsWith("b")
            ? { ...item, divergencias: { sem_correspondencia: item.lancamentos } }
            : item,
      ),
      RODADAS.length,
      { B: "2026-09", A: "2026-08" },
    );
    await renderizar();
    expect(pontosDoGrafico()).toEqual([
      ["ago", "100,0%"],
      ["set/26", "54,5%"],
    ]);
  });

  it("shows one sheet per conciliation, with the numbers of the round that counts", async () => {
    com(RODADAS);
    await renderizar();

    expect(conciliacoes()).toHaveLength(2);
    const [setembro, agosto] = conciliacoes();
    expect(setembro).toHaveTextContent("sicredi-setembro.ofx");
    expect(setembro).toHaveTextContent("erp-setembro-v2.csv");
    expect(setembro).toHaveTextContent("Rodada 2 de 2");
    // 12 de 22 pelas contagens, como o gráfico e a lista de Conciliações
    expect(setembro).toHaveTextContent("54,5% bateu");
    expect(setembro.querySelector("time")).toHaveTextContent("24/09 14:02");
    expect(agosto).toHaveTextContent("Rodada 1 de 1");
  });

  it("opens the newest conciliation in the panel, with the way to its comparison", async () => {
    com(RODADAS);
    await renderizar();

    const [setembro] = conciliacoes();
    expect(setembro).toHaveAttribute("aria-pressed", "true");
    const painel = previa();
    expect(within(painel).getByRole("heading", { level: 2 })).toHaveTextContent("Rodada 2 de 2");
    expect(painel).toHaveTextContent("12de 22 lançamentos batem");
    // pelo endereço só do banco, que abre a rodada mais recente
    expect(within(painel).getByRole("link", { name: "Abrir a comparação" })).toHaveAttribute("href", "/conciliacoes/B");
  });

  it("lists every execution of the chosen conciliation in the panel", async () => {
    com(RODADAS);
    await renderizar();

    const lista = within(previa()).getByRole("list", { name: "Execuções de sicredi-setembro.ofx" });
    const [vale, refeita, anterior] = within(lista).getAllByRole("listitem");
    expect(vale).toHaveTextContent("Rodada 2 · erp-setembro-v2.csv");
    expect(within(vale).getByText("Vale")).toBeInTheDocument();
    expect(refeita).toHaveTextContent("41,7%");
    expect(within(refeita).getByText("Substituída")).toBeInTheDocument();
    // o backend só guarda o resultado mais novo do par: não há o que abrir da refeita
    expect(within(refeita).queryByRole("link")).toBeNull();
    expect(anterior).toHaveTextContent("Rodada 1 · erp-setembro.csv");
    expect(within(anterior).getByText("Anterior")).toBeInTheDocument();
    expect(within(anterior).getByRole("link", { name: "Ver a rodada 1" })).toHaveAttribute(
      "href",
      "/conciliacoes/B?sistema=S1",
    );
  });

  it("chooses another conciliation with a click, and has no execution list for a single one", async () => {
    const user = userEvent.setup();
    com(RODADAS);
    await renderizar();

    const [, agosto] = conciliacoes();
    await user.click(agosto);
    expect(agosto).toHaveAttribute("aria-pressed", "true");
    expect(within(previa()).getByRole("heading", { level: 2 })).toHaveTextContent("Rodada 1 de 1");
    expect(within(previa()).queryByRole("list", { name: /Execuções de/ })).not.toBeInTheDocument();
  });

  it("groups each conciliation by the month of its extrato, like Fechamentos", async () => {
    com(
      [
        // a rodada nova do extrato de setembro rodou em outubro
        execucao({ id: "s1", extratoBancoId: "B", executadaEm: "2026-10-02T20:20:00Z" }),
        execucao({ id: "o1", extratoBancoId: "C", executadaEm: "2026-10-01T13:00:00Z" }),
      ],
      2,
      { B: "2026-09", C: "2026-10" },
    );
    await renderizar();

    expect(titulosDosMeses()).toEqual(["Outubro de 2026", "Setembro de 2026"]);
    // quando rodou continua sendo quando rodou
    const setembro = conciliacoes().find((folha) => folha.textContent?.includes("sicredi-s1.ofx"))!;
    expect(setembro.querySelector("time")).toHaveTextContent("02/10 17:20");
  });

  it("writes the year of the run when it is not the year of the extrato", async () => {
    com(
      [
        // o extrato de dezembro conciliado em janeiro
        execucao({ id: "d1", extratoBancoId: "D", executadaEm: "2026-01-05T13:00:00Z" }),
        execucao({ id: "j1", extratoBancoId: "J", executadaEm: "2026-01-04T13:00:00Z" }),
      ],
      2,
      { D: "2025-12", J: "2026-01" },
    );
    await renderizar();

    const folha = (id: string) => conciliacoes().find((item) => item.textContent?.includes(`sicredi-${id}.ofx`))!;
    expect(folha("d1").querySelector("time")).toHaveTextContent("05/01/2026 10:00");
    expect(folha("j1").querySelector("time")).toHaveTextContent("04/01 10:00");
  });

  it("falls back to the month the round that counts ran, when the extrato's month is unknown", async () => {
    com([...RODADAS, execucao({ id: "j1", executadaEm: "2026-08-05T13:00:00Z" })]);
    await renderizar();
    expect(titulosDosMeses()).toEqual(["Setembro de 2026", "Agosto de 2026"]);
    expect(screen.getByText("2 conciliações · 1 com pendência")).toBeInTheDocument();
  });

  it("counts what asks for review without the justified lines, and names the bar like the comparison", async () => {
    com([
      execucao({
        id: "e1",
        lancamentos: 22,
        divergencias: { divergente_valor: 4, duplicado: 2, sem_correspondencia: 4 },
        justificadas: 2,
      }),
    ]);
    await renderizar();

    const [folha] = conciliacoes();
    expect(within(folha).getByText("8 para revisar")).toBeInTheDocument();
    expect(within(previa()).getByText("Para revisar").nextSibling).toHaveTextContent("8 linhas · 2 justificadas");
    const barra = folha.querySelector(".hist-resultado-barra")!;
    expect([...barra.children].map((parte) => parte.getAttribute("title"))).toEqual([
      "Conciliado: 12",
      "Valor diverge, Duplicidade: 6",
      "Data diverge, Falta: 4",
    ]);
    const legenda = screen.getByRole("list", { name: "Legenda das barras" });
    expect(within(legenda).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Conciliado",
      "Valor diverge, Duplicidade",
      "Data diverge, Falta",
      "Tarifa",
    ]);
  });

  it("filters the conciliations that still ask for review", async () => {
    const user = userEvent.setup();
    com([
      execucao({ id: "e2", lancamentos: 10, divergencias: { divergente_valor: 1 } }),
      execucao({ id: "e1", lancamentos: 10, executadaEm: "2026-09-02T19:20:00Z" }),
    ]);
    await renderizar();

    await user.click(screen.getByRole("button", { name: "Com pendência (1)" }));
    expect(conciliacoes()).toHaveLength(1);
    expect(conciliacoes()[0]).toHaveTextContent("sicredi-e2.ofx");

    await user.click(screen.getByRole("button", { name: "Todas (2)" }));
    expect(conciliacoes()).toHaveLength(2);
  });

  it("counts the executions and the conciliations of the page in the header, without the old totals", async () => {
    com(RODADAS);
    await renderizar();
    expect(screen.getByText("4 execuções · 2 conciliações nesta página")).toBeInTheDocument();
    expect(screen.queryByText("Lançamentos processados")).not.toBeInTheDocument();
  });

  it("leaves the match out for an execution without lançamentos", async () => {
    com([execucao({ id: "e1", acerto: null, lancamentos: 0 })]);
    await renderizar();
    const [folha] = conciliacoes();
    expect(folha).toHaveTextContent("— bateu");
    expect(folha.querySelector(".hist-resultado-barra")).toBeNull();
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

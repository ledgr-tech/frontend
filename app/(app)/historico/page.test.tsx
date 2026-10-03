import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { Historico, Resultado } from "../conciliacoes/acoes";
import HistoricoPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarHistorico = vi.fn<(pagina?: number) => Promise<Resultado<Historico>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarHistorico: (pagina?: number) => carregarHistorico(pagina),
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
    justificadas: 0,
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
    acerto: 58.3,
  }),
  execucao({
    id: "b2",
    ...SETEMBRO,
    extratoSistemaId: "S2",
    arquivoSistema: "erp-setembro-v2.csv",
    executadaEm: "2026-09-24T09:10:00Z",
    lancamentos: 12,
    acerto: 41.7,
    atual: false,
  }),
  execucao({
    id: "b1",
    ...SETEMBRO,
    extratoSistemaId: "S1",
    arquivoSistema: "erp-setembro.csv",
    executadaEm: "2026-09-23T12:41:00Z",
    lancamentos: 3,
    acerto: 33.3,
  }),
  execucao({
    id: "a1",
    extratoBancoId: "A",
    arquivoBanco: "sicredi-agosto.ofx",
    arquivoSistema: "erp-agosto.csv",
    executadaEm: "2026-09-02T19:20:00Z",
    lancamentos: 3980,
    acerto: 91.8,
  }),
];

function com(execucoes: Execucao[], total = execucoes.length, competencias: Record<string, string> = {}) {
  carregarHistorico.mockResolvedValue({ ok: true, dados: { execucoes, total, porPagina: 50, competencias } });
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

/** A linha de cada conciliação, na ordem da tela. */
function conciliacoes() {
  return [...document.querySelectorAll<HTMLElement>("tr.hist-conciliacao")];
}

/** As execuções abertas debaixo das conciliações. */
function execucoesAbertas() {
  return [...document.querySelectorAll<HTMLElement>("tr.hist-execucao")].filter((linha) => !linha.hidden);
}

describe("HistoricoPage", () => {
  beforeEach(() => {
    carregarHistorico.mockReset();
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

  it("lists one row per conciliation, with the numbers of the round that counts", async () => {
    com(RODADAS);
    await renderizar();

    expect(conciliacoes()).toHaveLength(2);
    const [setembro, agosto] = conciliacoes();
    expect(setembro).toHaveTextContent("sicredi-setembro.ofx");
    expect(setembro).toHaveTextContent("erp-setembro-v2.csv");
    expect(setembro).toHaveTextContent("Rodada 2 de 2");
    expect(setembro.querySelector(".hist-c-lancamentos")).toHaveTextContent("22");
    expect(setembro.querySelector(".hist-c-match")).toHaveTextContent("58,3%");
    expect(setembro.querySelector(".hist-c-quando")).toHaveTextContent("24/09 14:02");
    // pelo endereço só do banco, que abre a rodada mais recente
    expect(within(setembro).getByRole("link", { name: "Ver sicredi-setembro.ofx" })).toHaveAttribute(
      "href",
      "/conciliacoes/B",
    );
    expect(agosto).toHaveTextContent("Rodada 1 de 1");
    // a nota do "Ver atual" era das execuções soltas: aqui a refeita não abre nada
    expect(screen.queryByText(/Só o resultado mais recente fica guardado/)).not.toBeInTheDocument();
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

    const meses = screen.getAllByRole("heading", { level: 3 });
    expect(meses.map((mes) => mes.textContent)).toEqual(["Outubro de 20261 conciliação", "Setembro de 20261 conciliação"]);
    // quando rodou continua sendo quando rodou
    const setembro = conciliacoes().find((linha) => linha.textContent?.includes("sicredi-s1.ofx"))!;
    expect(setembro.querySelector(".hist-c-quando")).toHaveTextContent("02/10 17:20");
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

    const linha = (id: string) => conciliacoes().find((item) => item.textContent?.includes(`sicredi-${id}.ofx`))!;
    expect(linha("d1").querySelector(".hist-c-quando")).toHaveTextContent("05/01/2026 10:00");
    expect(linha("j1").querySelector(".hist-c-quando")).toHaveTextContent("04/01 10:00");
  });

  it("falls back to the month the round that counts ran, when the extrato's month is unknown", async () => {
    com([...RODADAS, execucao({ id: "j1", executadaEm: "2026-08-05T13:00:00Z" })]);
    await renderizar();
    const meses = screen.getAllByRole("heading", { level: 3 });
    expect(meses.map((mes) => mes.textContent)).toEqual([
      "Setembro de 20262 conciliações",
      "Agosto de 20261 conciliação",
    ]);
  });

  it("opens the rounds and the redone executions under the conciliation", async () => {
    const user = userEvent.setup();
    com(RODADAS);
    await renderizar();
    expect(execucoesAbertas()).toHaveLength(0);

    const abrir = screen.getByRole("button", { name: "Execuções de sicredi-setembro.ofx" });
    expect(abrir).toHaveAttribute("aria-expanded", "false");
    await user.click(abrir);
    expect(abrir).toHaveAttribute("aria-expanded", "true");

    const [vale, refeita, anterior] = execucoesAbertas();
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

    await user.click(abrir);
    expect(execucoesAbertas()).toHaveLength(0);
  });

  it("has nothing to open in a conciliation with a single execution", async () => {
    com(RODADAS);
    await renderizar();
    expect(screen.queryByRole("button", { name: "Execuções de sicredi-agosto.ofx" })).not.toBeInTheDocument();
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

    const [linha] = conciliacoes();
    expect(linha.querySelector(".hist-c-revisar")).toHaveTextContent("8 · 2 justificadas");
    const barra = linha.querySelector(".hist-resultado-barra")!;
    expect([...barra.children].map((parte) => parte.getAttribute("title"))).toEqual([
      "Bate: 12",
      "Valor diverge, Duplicidade: 6",
      "Data diverge, Falta: 4",
    ]);
    const legenda = screen.getByRole("list", { name: "Legenda das barras" });
    expect(within(legenda).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Bate",
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

  it("groups by year, with the past years closed", async () => {
    const user = userEvent.setup();
    com([
      execucao({ id: "e2", executadaEm: "2026-02-10T12:00:00Z" }),
      execucao({ id: "e1", executadaEm: "2025-11-10T12:00:00Z", lancamentos: 10, divergencias: { duplicado: 1 } }),
    ]);
    await renderizar();

    expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute("aria-expanded", "true");
    const passado = screen.getByRole("button", { name: "2025" });
    expect(passado).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("1 conciliação · 1 com pendência")).toBeInTheDocument();
    const antiga = conciliacoes().find((linha) => linha.textContent?.includes("sicredi-e1.ofx"))!;
    expect(antiga.closest("[hidden]")).not.toBeNull();

    await user.click(passado);
    expect(antiga.closest("[hidden]")).toBeNull();
  });

  it("sums up only the round that counts of each conciliation", async () => {
    com(RODADAS);
    await renderizar();
    const resumo = document.querySelector(".hist-resumo") as HTMLElement;
    expect(within(resumo).getByText("Conciliações").nextSibling).toHaveTextContent("2");
    // b3 (22) + a1 (3.980): a rodada 1 e a refeita não somam de novo
    expect(within(resumo).getByText("Lançamentos processados").nextSibling).toHaveTextContent("4.002");
  });

  it("leaves the match out for an execution without lançamentos", async () => {
    com([execucao({ id: "e1", acerto: null, lancamentos: 0 })]);
    await renderizar();
    const [linha] = conciliacoes();
    expect(linha.querySelector(".hist-c-lancamentos")).toHaveTextContent("0");
    expect(linha.querySelector(".hist-c-match")).toHaveTextContent("—");
    expect(linha.querySelector(".hist-resultado-barra")).toBeNull();
  });

  it("does not show the savings block, which has no data behind it", async () => {
    com(EXECUCOES);
    await renderizar();
    expect(screen.queryByText("Economia acumulada")).not.toBeInTheDocument();
  });

  it("pages through the backend's executions", async () => {
    com(EXECUCOES, 120);
    await renderizar("1");

    expect(carregarHistorico).toHaveBeenCalledWith(1);
    expect(screen.getByText("51–53 de 120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mais recentes" })).toHaveAttribute("href", "/historico");
    expect(screen.getByRole("link", { name: "Mais antigas" })).toHaveAttribute("href", "/historico?pagina=2");
    expect(screen.getByText("Somando as execuções desta página.")).toBeInTheDocument();
  });

  it("starts from the first page when the page in the URL makes no sense", async () => {
    com(EXECUCOES);
    await renderizar("-3");
    expect(carregarHistorico).toHaveBeenCalledWith(0);
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
    carregarHistorico.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    await renderizar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar o histórico. Recarregue a página e tente de novo.",
    );
  });

  it("sends an expired session back to the login", async () => {
    carregarHistorico.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(HistoricoPage(props())).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

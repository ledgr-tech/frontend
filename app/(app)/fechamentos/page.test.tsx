import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao, Fechamento } from "@/lib/adaptadores";
import type { DadosDoFechamento, ParDoFechamento, Resultado } from "../conciliacoes/acoes";
import FechamentosPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarFechamentos = vi.fn<() => Promise<Resultado<DadosDoFechamento>>>();
const fecharMes = vi.fn<(competencia: string, ressalva?: string) => Promise<Resultado<Fechamento>>>();
const reabrirMes = vi.fn<(competencia: string) => Promise<Resultado<Fechamento>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarFechamentos: () => carregarFechamentos(),
  fecharMes: (competencia: string, ressalva?: string) => fecharMes(competencia, ressalva),
  reabrirMes: (competencia: string) => reabrirMes(competencia),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
  // o botão de exportar CSV do painel usa o router para mandar ao login; fechar e reabrir, para
  // ler a tela de novo
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const refresh = vi.fn();

/** Um fechamento como a action devolve. */
function fechamento(competencia: string, parcial: Partial<Fechamento> = {}): Fechamento {
  return {
    competencia,
    estado: "fechado",
    ressalva: null,
    fechadoPor: "Maria Financeiro",
    fechadoEm: "2026-10-06T15:20:00Z",
    reabertoPor: null,
    reabertoEm: null,
    ...parcial,
  };
}

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d";

function par(
  id: string,
  parcial: Partial<Execucao> = {},
  extra: Partial<Omit<ParDoFechamento, "execucao">> = {},
): ParDoFechamento {
  return {
    execucao: {
      id,
      extratoBancoId: BANCO,
      extratoSistemaId: SISTEMA,
      arquivoBanco: `sicredi-${id}.ofx`,
      arquivoSistema: `erp-${id}.csv`,
      executadaEm: "2026-09-24T17:02:11Z",
      lancamentos: 140,
      acerto: 100,
      divergencias: {},
      toleranciaDias: 1,
      atual: true,
      justificadas: 0,
      periodoInicio: "2026-09-01",
      ...parcial,
    },
    naoLidas: [],
    ...extra,
  };
}

const SETEMBRO_EM_ABERTO = par("set", {
  acerto: 70,
  divergencias: { divergente_valor: 7, sem_correspondencia: 35 },
});
const AGOSTO_PRONTO = par("ago", { executadaEm: "2026-09-02T10:00:00Z", periodoInicio: "2026-08-01" });

async function renderizar(
  pares: ParDoFechamento[] = [SETEMBRO_EM_ABERTO, AGOSTO_PRONTO],
  busca: Record<string, string> = {},
  fechamentos: Fechamento[] | null = [],
) {
  carregarFechamentos.mockResolvedValue({ ok: true, dados: { pares, fechamentos } });
  render(await FechamentosPage({ searchParams: Promise.resolve(busca) }));
}

function painel() {
  return screen.getByRole("region", { name: "Mês selecionado" });
}

describe("FechamentosPage", () => {
  beforeEach(() => {
    carregarFechamentos.mockReset();
    redirect.mockReset();
    fecharMes.mockReset();
    reabrirMes.mockReset();
    refresh.mockReset();
  });

  it("shows one sheet per month, the most recent first and open in the panel", async () => {
    await renderizar();

    expect(screen.getByText("2 competências")).toBeInTheDocument();
    const setembro = screen.getByRole("button", { name: /Setembro de 2026/ });
    const agosto = screen.getByRole("button", { name: /Agosto de 2026/ });
    // o mais recente primeiro, e aberto
    expect(setembro.compareDocumentPosition(agosto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(setembro).toHaveAttribute("aria-pressed", "true");
    expect(within(painel()).getByRole("heading", { name: "Setembro de 2026" })).toBeInTheDocument();
  });

  it("opens on the month named in the URL, where the line of rounds of a conciliação leads", async () => {
    await renderizar(undefined, { mes: "2026-08" });

    expect(screen.getByRole("button", { name: /Agosto de 2026/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(painel()).getByRole("heading", { name: "Agosto de 2026" })).toBeInTheDocument();
  });

  it("falls back to the most recent month when the URL names one that has nothing", async () => {
    await renderizar(undefined, { mes: "2025-01" });

    expect(within(painel()).getByRole("heading", { name: "Setembro de 2026" })).toBeInTheDocument();
  });

  it("lists what still holds the month open and leads to the review", async () => {
    await renderizar();

    const aberto = painel();
    expect(within(aberto).getByText("Fechamento · em aberto")).toBeInTheDocument();
    expect(within(aberto).getByText("98 de 140 lançamentos conciliados")).toBeInTheDocument();
    const passos = within(aberto).getByRole("list", { name: "Para fechar o mês" });
    expect(within(passos).getByText(/Divergências decididas/)).toHaveTextContent("(pendente)");
    expect(within(passos).getByText("Valor diverge na mesma data")).toBeInTheDocument();
    expect(within(passos).getByText("Sem correspondência")).toBeInTheDocument();
    expect(within(passos).getByText(/Arquivos lidos por inteiro/)).toHaveTextContent("(feito)");

    const revisar = within(aberto).getByRole("link", { name: "Revisar pendências" });
    expect(revisar).toHaveAttribute("href", `/conciliacoes/${BANCO}?sistema=${SISTEMA}`);
    expect(within(aberto).queryByRole("link", { name: /Começar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Setembro de 2026/ })).toHaveTextContent("42 pendências");
  });

  it("opens another month when its sheet is picked, and offers to close it when it is ready", async () => {
    const user = userEvent.setup();
    await renderizar();

    await user.click(screen.getByRole("button", { name: /Agosto de 2026/ }));

    const pronto = painel();
    expect(within(pronto).getByText("Fechamento · pronto para fechar")).toBeInTheDocument();
    expect(within(pronto).getByText("Nenhuma divergência pede decisão.")).toBeInTheDocument();
    expect(within(pronto).getByRole("button", { name: "Fechar agosto" })).toBeInTheDocument();
    // o próximo mês começa depois de fechar este
    expect(within(pronto).queryByRole("link", { name: /Começar/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agosto de 2026/ })).toHaveTextContent("Pronto para fechar");
  });

  describe("closing the month", () => {
    it("closes a ready month and reads the screen again", async () => {
      const user = userEvent.setup();
      fecharMes.mockResolvedValue({ ok: true, dados: fechamento("2026-08") });
      await renderizar(undefined, { mes: "2026-08" });

      await user.click(within(painel()).getByRole("button", { name: "Fechar agosto" }));

      expect(fecharMes).toHaveBeenCalledWith("2026-08", undefined);
      expect(refresh).toHaveBeenCalled();
    });

    it("shows a closed month as closed, by whom, and offers the next month and reopening", async () => {
      await renderizar(undefined, { mes: "2026-08" }, [fechamento("2026-08")]);

      expect(screen.getByRole("button", { name: /Agosto de 2026/ })).toHaveTextContent("Fechado");
      const fechado = painel();
      expect(within(fechado).getByText("Fechamento · fechado")).toBeInTheDocument();
      expect(within(fechado).getByText("Fechado em 06/10/2026 12:20 por Maria Financeiro.")).toBeInTheDocument();
      expect(within(fechado).getByRole("link", { name: "Começar setembro" })).toHaveAttribute("href", "/conciliacoes/nova");
      expect(within(fechado).getByRole("button", { name: "Reabrir agosto" })).toBeInTheDocument();
      expect(within(fechado).queryByRole("button", { name: "Fechar agosto" })).not.toBeInTheDocument();
    });

    it("reopens a closed month", async () => {
      const user = userEvent.setup();
      reabrirMes.mockResolvedValue({ ok: true, dados: fechamento("2026-08", { estado: "reaberto" }) });
      await renderizar(undefined, { mes: "2026-08" }, [fechamento("2026-08")]);

      await user.click(within(painel()).getByRole("button", { name: "Reabrir agosto" }));

      expect(reabrirMes).toHaveBeenCalledWith("2026-08");
      expect(refresh).toHaveBeenCalled();
    });

    it("asks for a ressalva when the backend says what still holds the month, and closes with it", async () => {
      const user = userEvent.setup();
      const falta = "Há 42 divergências sem justificativa nesta competência. Justifique, corrija ou feche com ressalva.";
      fecharMes.mockResolvedValueOnce({ ok: false, status: 409, erro: falta });
      fecharMes.mockResolvedValueOnce({ ok: true, dados: fechamento("2026-09", { ressalva: "Em análise com o banco." }) });
      await renderizar();

      const aberto = painel();
      // com pendência, o caminho principal continua sendo revisar
      expect(within(aberto).getByRole("link", { name: "Revisar pendências" })).toBeInTheDocument();
      await user.click(within(aberto).getByRole("button", { name: "Fechar mesmo assim" }));

      expect(fecharMes).toHaveBeenCalledWith("2026-09", undefined);
      expect(within(aberto).getByRole("alert")).toHaveTextContent(falta);
      await user.type(within(aberto).getByLabelText("Ressalva"), "Em análise com o banco.");
      await user.click(within(aberto).getByRole("button", { name: "Fechar com ressalva" }));

      expect(fecharMes).toHaveBeenLastCalledWith("2026-09", "Em análise com o banco.");
      expect(refresh).toHaveBeenCalled();
    });

    it("does not send an empty ressalva", async () => {
      const user = userEvent.setup();
      fecharMes.mockResolvedValue({ ok: false, status: 409, erro: "Há 42 divergências sem justificativa nesta competência." });
      await renderizar();

      await user.click(within(painel()).getByRole("button", { name: "Fechar mesmo assim" }));

      expect(within(painel()).getByRole("button", { name: "Fechar com ressalva" })).toBeDisabled();
    });

    it("shows the ressalva of a month closed with one", async () => {
      await renderizar(undefined, {}, [fechamento("2026-09", { ressalva: "Diferença de R$ 25,50 em análise com o banco." })]);

      expect(screen.getByRole("button", { name: /Setembro de 2026/ })).toHaveTextContent("Fechado com ressalva");
      expect(within(painel()).getByText("Diferença de R$ 25,50 em análise com o banco.")).toBeInTheDocument();
    });

    it("says when a month was reopened, and lets it be closed again", async () => {
      await renderizar(undefined, { mes: "2026-08" }, [
        fechamento("2026-08", { estado: "reaberto", reabertoPor: "Ana", reabertoEm: "2026-10-07T10:00:00Z" }),
      ]);

      const reaberto = painel();
      expect(within(reaberto).getByText("Reaberto em 07/10/2026 07:00 por Ana.")).toBeInTheDocument();
      expect(within(reaberto).getByRole("button", { name: "Fechar agosto" })).toBeInTheDocument();
    });

    it("filters the closed months", async () => {
      const user = userEvent.setup();
      await renderizar(undefined, {}, [fechamento("2026-08")]);

      // fechado, agosto não está mais "pronto para fechar"
      expect(screen.getByRole("button", { name: "Prontos para fechar (0)" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Fechados (1)" }));

      expect(screen.queryByRole("button", { name: /Setembro de 2026/ })).not.toBeInTheDocument();
      expect(within(painel()).getByRole("heading", { name: "Agosto de 2026" })).toBeInTheDocument();
    });

    it("offers no closing when the closures could not be read, and the ready month leads to the next", async () => {
      await renderizar(undefined, { mes: "2026-08" }, null);

      const pronto = painel();
      expect(within(pronto).queryByRole("button", { name: /Fechar/ })).not.toBeInTheDocument();
      expect(within(pronto).getByRole("link", { name: "Começar setembro" })).toBeInTheDocument();
    });
  });

  describe("justified divergences", () => {
    it("calls a month ready when every divergence is justified, and says how many", async () => {
      await renderizar([par("set", { acerto: 98.6, divergencias: { divergente_valor: 2 }, justificadas: 2 })]);

      expect(screen.getByRole("button", { name: /Setembro de 2026/ })).toHaveTextContent("Pronto para fechar");
      const pronto = painel();
      expect(within(pronto).getByText("Fechamento · pronto para fechar")).toBeInTheDocument();
      const passos = within(pronto).getByRole("list", { name: "Para fechar o mês" });
      expect(within(passos).getByText(/Divergências decididas/)).toHaveTextContent("(feito)");
      expect(within(passos).getByText("2 divergências justificadas")).toBeInTheDocument();
      expect(within(pronto).getByRole("button", { name: "Fechar setembro" })).toBeInTheDocument();
    });

    it("keeps the month open while one of two divergences has no justification", async () => {
      await renderizar([par("set", { acerto: 98.6, divergencias: { divergente_valor: 2 }, justificadas: 1 })]);

      expect(screen.getByRole("button", { name: /Setembro de 2026/ })).toHaveTextContent("1 pendência");
      const aberto = painel();
      expect(within(aberto).getByText("Fechamento · em aberto")).toBeInTheDocument();
      const passos = within(aberto).getByRole("list", { name: "Para fechar o mês" });
      expect(within(passos).getByText(/Divergências decididas/)).toHaveTextContent("(pendente)");
      expect(within(passos).getByText("1 divergência justificada")).toBeInTheDocument();
      expect(within(aberto).getByRole("link", { name: "Revisar pendências" })).toBeInTheDocument();
    });
  });

  it("filters the months that are ready", async () => {
    const user = userEvent.setup();
    await renderizar();

    await user.click(screen.getByRole("button", { name: "Prontos para fechar (1)" }));

    expect(screen.queryByRole("button", { name: /Setembro de 2026/ })).not.toBeInTheDocument();
    expect(within(painel()).getByRole("heading", { name: "Agosto de 2026" })).toBeInTheDocument();
  });

  it("does not call a month ready while a file has lines nobody read", async () => {
    await renderizar([par("x", {}, { naoLidas: [{ nome: "erp-x.csv", linhas: 2 }] })]);

    const aberto = painel();
    expect(within(aberto).getByText("2 linhas não lidas em erp-x.csv")).toBeInTheDocument();
    expect(within(aberto).getByRole("link", { name: "Ver extratos" })).toHaveAttribute("href", "/extratos");
    expect(screen.getByRole("button", { name: /Setembro de 2026/ })).toHaveTextContent("Linhas não lidas");
  });

  it("offers the CSV of each conciliação for the accountant", async () => {
    await renderizar();
    expect(within(painel()).getByRole("button", { name: "Exportar CSV" })).toBeInTheDocument();
  });

  it("guides the first upload when nothing was conciliated yet", async () => {
    await renderizar([]);
    expect(screen.getByRole("heading", { name: "Nenhum mês para fechar ainda." })).toBeInTheDocument();
  });

  it("no longer says the Ledgr does not record the closing", async () => {
    await renderizar();
    expect(screen.queryByText(/ainda não registra o encerramento/)).not.toBeInTheDocument();
  });

  it("says so when the backend fails", async () => {
    carregarFechamentos.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    render(await FechamentosPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os fechamentos.");
  });

  it("sends an expired session to the login", async () => {
    carregarFechamentos.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(FechamentosPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  describe("with months from more than one year", () => {
    const mes = (id: string, periodoInicio: string, divergencias: Execucao["divergencias"] = {}) =>
      par(id, { executadaEm: `${periodoInicio.slice(0, 7)}-28T12:00:00Z`, divergencias, periodoInicio });
    const VARIOS_ANOS = [
      SETEMBRO_EM_ABERTO,
      AGOSTO_PRONTO,
      mes("dez25", "2025-12-01", { sem_correspondencia: 3 }),
      mes("nov25", "2025-11-01"),
      mes("out25", "2025-10-01"),
      mes("dez24", "2024-12-01"),
      mes("nov24", "2024-11-01"),
    ];
    const ano = (nome: string) => screen.getByRole("region", { name: nome });

    it("groups the months under a heading per year, the most recent year first", async () => {
      await renderizar(VARIOS_ANOS);

      const anos = screen.getAllByRole("heading", { level: 2 }).map((titulo) => titulo.textContent);
      expect(anos).toEqual(["2026", "2025", "2024"]);
      expect(within(ano("2025")).getByText("3 competências · 1 com pendência")).toBeInTheDocument();
    });

    it("shows every month of the current year, and only the months still open from past years", async () => {
      await renderizar(VARIOS_ANOS);

      expect(within(ano("2026")).getByRole("button", { name: /Setembro de 2026/ })).toBeInTheDocument();
      expect(within(ano("2026")).getByRole("button", { name: /Agosto de 2026/ })).toBeInTheDocument();
      expect(within(ano("2025")).getByRole("button", { name: /Dezembro de 2025/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Novembro de 2025/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Dezembro de 2024/ })).not.toBeInTheDocument();
    });

    it("folds a past year that is all ready into one line, and opens it on click", async () => {
      const user = userEvent.setup();
      await renderizar(VARIOS_ANOS);

      expect(within(ano("2024")).getByText("2 competências · todas prontas")).toBeInTheDocument();
      const mostrar = within(ano("2024")).getByRole("button", { name: "Mostrar os 2 meses prontos" });
      expect(mostrar).toHaveAttribute("aria-expanded", "false");

      await user.click(mostrar);

      expect(within(ano("2024")).getByRole("button", { name: /Dezembro de 2024/ })).toBeInTheDocument();
      expect(within(ano("2024")).getByRole("button", { name: /Novembro de 2024/ })).toBeInTheDocument();
      expect(within(ano("2024")).getByRole("button", { name: "Esconder os meses prontos" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("folds a whole year from its title, so the next year comes up without scrolling", async () => {
      const user = userEvent.setup();
      await renderizar(VARIOS_ANOS);

      const titulo = within(ano("2026")).getByRole("button", { name: "2026" });
      expect(titulo).toHaveAttribute("aria-expanded", "true");

      await user.click(titulo);

      expect(titulo).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("button", { name: /Setembro de 2026/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Agosto de 2026/ })).not.toBeInTheDocument();
      // o resumo continua à vista, e o próximo ano segue como estava
      expect(within(ano("2026")).getByText("2 competências · 1 com pendência")).toBeInTheDocument();
      expect(within(ano("2025")).getByRole("button", { name: /Dezembro de 2025/ })).toBeInTheDocument();

      await user.click(titulo);
      expect(screen.getByRole("button", { name: /Setembro de 2026/ })).toBeInTheDocument();
    });

    it("folds nothing when the filter asks for the ready months", async () => {
      const user = userEvent.setup();
      await renderizar(VARIOS_ANOS);

      await user.click(screen.getByRole("button", { name: "Prontos para fechar (5)" }));

      expect(screen.getByRole("button", { name: /Novembro de 2025/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dezembro de 2024/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Mostrar/ })).not.toBeInTheDocument();
    });

    it("keeps a single year without a year heading", async () => {
      await renderizar();
      expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    });
  });
});

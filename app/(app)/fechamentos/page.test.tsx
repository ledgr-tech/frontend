import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { ParDoFechamento, Resultado } from "../conciliacoes/acoes";
import FechamentosPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarFechamentos = vi.fn<() => Promise<Resultado<ParDoFechamento[]>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarFechamentos: () => carregarFechamentos(),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
  // o botão de exportar CSV do painel usa o router para mandar ao login
  useRouter: () => ({ push: vi.fn() }),
}));

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
      atual: true,
      ...parcial,
    },
    primeiraData: "2026-09-01",
    naoLidas: [],
    ...extra,
  };
}

const SETEMBRO_EM_ABERTO = par("set", {
  acerto: 70,
  divergencias: { divergente_valor: 7, sem_correspondencia: 35 },
});
const AGOSTO_PRONTO = par("ago", { executadaEm: "2026-09-02T10:00:00Z" }, { primeiraData: "2026-08-01" });

async function renderizar(dados: ParDoFechamento[] = [SETEMBRO_EM_ABERTO, AGOSTO_PRONTO]) {
  carregarFechamentos.mockResolvedValue({ ok: true, dados });
  render(await FechamentosPage());
}

function painel() {
  return screen.getByRole("region", { name: "Mês selecionado" });
}

describe("FechamentosPage", () => {
  beforeEach(() => {
    carregarFechamentos.mockReset();
    redirect.mockReset();
  });

  it("shows one sheet per month, the most recent first and open in the panel", async () => {
    await renderizar();

    expect(screen.getByText(/· 2 competências$/)).toBeInTheDocument();
    const setembro = screen.getByRole("button", { name: /Setembro de 2026/ });
    const agosto = screen.getByRole("button", { name: /Agosto de 2026/ });
    // o mais recente primeiro, e aberto
    expect(setembro.compareDocumentPosition(agosto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(setembro).toHaveAttribute("aria-pressed", "true");
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

  it("opens another month when its sheet is picked, and offers to start the next one when it is ready", async () => {
    const user = userEvent.setup();
    await renderizar();

    await user.click(screen.getByRole("button", { name: /Agosto de 2026/ }));

    const pronto = painel();
    expect(within(pronto).getByText("Fechamento · pronto para fechar")).toBeInTheDocument();
    expect(within(pronto).getByText("Nenhuma divergência pede decisão.")).toBeInTheDocument();
    expect(within(pronto).getByRole("link", { name: "Começar setembro" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.getByRole("button", { name: /Agosto de 2026/ })).toHaveTextContent("Pronto para fechar");
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

  it("says so when the backend fails", async () => {
    carregarFechamentos.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    render(await FechamentosPage());
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os fechamentos.");
  });

  it("sends an expired session to the login", async () => {
    carregarFechamentos.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(FechamentosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Fechamento, ResumoDoFechamento } from "@/lib/adaptadores";
import type { Conciliacao, LinhaComparacao } from "@/lib/mock-data";
import type { DadosDoRelatorio, Resultado } from "../../../conciliacoes/acoes";
import RelatorioPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarRelatorioDoFechamento = vi.fn<(competencia: string) => Promise<Resultado<DadosDoRelatorio>>>();
vi.mock("../../../conciliacoes/acoes", () => ({
  carregarRelatorioDoFechamento: (competencia: string) => carregarRelatorioDoFechamento(competencia),
}));

const redirect = vi.fn();
const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  // os dois interrompem a renderização lançando; os mocks imitam isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    notFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const FECHAMENTO: Fechamento = {
  competencia: "2026-09",
  estado: "fechado",
  ressalva: "Tarifa de setembro em análise com o banco.",
  fechadoPor: "Maria Financeiro",
  fechadoEm: "2026-10-06T15:20:00Z",
  reabertoPor: null,
  reabertoEm: null,
};

const RESUMO: ResumoDoFechamento = {
  pares: [
    {
      extratoBancoId: "b-1",
      extratoSistemaId: "s-1",
      rodada: 2,
      arquivoBanco: "extrato-092026.ofx",
      arquivoSistema: "razao-092026.csv",
    },
  ],
  contagens: {
    total: 4218,
    match_exato: 4100,
    match_tolerancia: 90,
    divergente_valor: 20,
    duplicado: 2,
    divergente_data: 4,
    sem_correspondencia: 1,
    tarifa_bancaria: 1,
  },
  justificadas: 27,
  pendentes: 1,
  linhasNaoLidas: 0,
  valorEmAberto: 36,
};

function linha(parcial: Partial<LinhaComparacao>): LinhaComparacao {
  return {
    id: "l",
    descricao: "Boleto Aço Norte",
    data: "04/09",
    dataISO: "2026-09-04",
    valorBanco: -12640,
    valorSistema: -12604,
    status: "divergente_valor",
    decisao: null,
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

const CONCILIACAO: Conciliacao = {
  id: "b-1",
  mes: "Setembro/2026",
  status: "fechada",
  linhas: [
    linha({
      id: "j",
      decisao: {
        tipo: "justificada",
        texto: "Juros cobrados pelo fornecedor.",
        autor: "Maria Financeiro",
        em: "2026-10-05T13:00:00Z",
        rodada: 2,
      },
    }),
    linha({ id: "p", descricao: "Tarifa avulsa", status: "tarifa_bancaria", valorBanco: -36, valorSistema: null }),
  ],
};

function fechado(): Resultado<DadosDoRelatorio> {
  return {
    ok: true,
    dados: {
      fechamento: FECHAMENTO,
      resumo: RESUMO,
      empresa: { razaoSocial: "Telha Certa Ltda", cnpj: "12345678000195" },
      conciliacoes: [{ conciliacao: CONCILIACAO, truncada: false }],
    },
  };
}

async function abrir(competencia = "2026-09", busca: Record<string, string> = {}) {
  render(
    await RelatorioPage({
      params: Promise.resolve({ competencia }),
      searchParams: Promise.resolve(busca),
    } as PageProps<"/fechamentos/[competencia]/relatorio">),
  );
}

describe("relatório do fechamento", () => {
  const print = vi.fn();

  beforeEach(() => {
    carregarRelatorioDoFechamento.mockReset();
    redirect.mockReset();
    notFound.mockReset();
    print.mockReset();
    vi.stubGlobal("print", print);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra a empresa, a competência, a situação e quem fechou", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue(fechado());

    await abrir();

    expect(carregarRelatorioDoFechamento).toHaveBeenCalledWith("2026-09");
    expect(screen.getByRole("heading", { level: 1, name: "Setembro de 2026" })).toBeInTheDocument();
    expect(screen.getByText("Telha Certa Ltda")).toBeInTheDocument();
    expect(screen.getByText("CNPJ 12.345.678/0001-95")).toBeInTheDocument();
    expect(screen.getByText("Fechado com ressalva")).toBeInTheDocument();
    expect(screen.getByText(/Fechado em 06\/10\/2026 12:20 por Maria Financeiro/)).toBeInTheDocument();
  });

  it("traz o resumo congelado e o texto da ressalva", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue(fechado());

    await abrir();

    const resumo = screen.getByRole("region", { name: "Resumo do mês" });
    expect(within(resumo).getByText("4.218")).toBeInTheDocument();
    expect(within(resumo).getByText("4.190")).toBeInTheDocument();
    expect(within(resumo).getByText("R$ 36,00")).toBeInTheDocument();
    expect(screen.getByText("Tarifa de setembro em análise com o banco.")).toBeInTheDocument();
  });

  it("lista, por par, as justificadas com quem decidiu e as pendentes", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue(fechado());

    await abrir();

    const justificadas = screen.getByRole("table", { name: "Linhas justificadas" });
    expect(within(justificadas).getByText("Juros cobrados pelo fornecedor.")).toBeInTheDocument();
    expect(within(justificadas).getByText(/Maria Financeiro · 05\/10\/2026/)).toBeInTheDocument();
    const pendentes = screen.getByRole("table", { name: "Linhas pendentes" });
    expect(within(pendentes).getByText("Tarifa avulsa")).toBeInTheDocument();
  });

  it("par que não carregou diz isso, em vez de parecer sem linhas", async () => {
    const resposta = fechado();
    if (resposta.ok && resposta.dados.fechamento) resposta.dados.conciliacoes = [null];
    carregarRelatorioDoFechamento.mockResolvedValue(resposta);

    await abrir();

    expect(screen.getByText(/Não foi possível carregar as linhas deste par/)).toBeInTheDocument();
  });

  it("mês sem fechamento em vigor avisa e volta para Fechamentos", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue({ ok: true, dados: { fechamento: null } });

    await abrir();

    expect(screen.getByRole("heading", { name: "Setembro de 2026 ainda não está fechado." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Fechamentos" })).toHaveAttribute("href", "/fechamentos?mes=2026-09");
    expect(screen.queryByRole("button", { name: /Imprimir/ })).not.toBeInTheDocument();
  });

  it("competência inválida é 404", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue({ ok: false, status: 404, erro: "Competência não encontrada." });

    await expect(abrir("2026-13")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sessão vencida vai para o login", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });

    await expect(abrir()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("o botão abre a impressão do navegador, de onde sai o PDF", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue(fechado());
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: "Imprimir ou salvar PDF" }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it("aberto pelo Baixar PDF (?imprimir=1), já chama a impressão", async () => {
    carregarRelatorioDoFechamento.mockResolvedValue(fechado());

    await abrir("2026-09", { imprimir: "1" });

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });
});

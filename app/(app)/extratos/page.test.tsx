import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArquivoExtrato, ListaDeExtratos, Resultado } from "../conciliacoes/acoes";
import ExtratosPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const listarExtratos = vi.fn<() => Promise<Resultado<ListaDeExtratos>>>();
vi.mock("../conciliacoes/acoes", () => ({
  listarExtratos: () => listarExtratos(),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

const ARQUIVOS: ArquivoExtrato[] = [
  {
    id: "b-set",
    nome: "sicredi-setembro.ofx",
    origem: "banco",
    conciliadoEm: "2026-09-24T17:02:11Z",
    resultado: "/conciliacoes/b-set",
    situacao: "concluido",
    lancamentos: 4218,
    naoLidas: 0,
    erros: [],
    competencia: "2026-09",
    enviadoEm: "2026-09-24T16:58:00Z",
    conciliado: true,
  },
  {
    id: "s-set",
    nome: "erp-setembro.csv",
    origem: "sistema",
    conciliadoEm: "2026-09-24T17:02:11Z",
    resultado: "/conciliacoes/b-set",
    situacao: "concluido",
    lancamentos: 4203,
    naoLidas: 0,
    erros: [],
    competencia: "2026-09",
    enviadoEm: "2026-09-24T16:59:00Z",
    conciliado: true,
  },
];

async function renderizar() {
  render(await ExtratosPage());
}

describe("ExtratosPage", () => {
  beforeEach(() => {
    listarExtratos.mockReset();
    redirect.mockClear();
  });

  it("shows the files under the same title the menu uses", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: { arquivos: ARQUIVOS, total: 2 } });
    await renderizar();

    const titulo = screen.getByRole("heading", { level: 1, name: "Extratos" });
    // a contagem vai no cabeçalho, sob o título (o grupo do mês repete a dele, que aqui é a mesma)
    expect(titulo.nextElementSibling).toHaveTextContent("2 arquivos");
    // "Nova conciliação" já está no menu: o cabeçalho não repete o botão dourado
    expect(screen.queryByRole("link", { name: "Carregar arquivo" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sicredi-setembro\.ofx/ })).toBeInTheDocument();
  });

  it("lists every file sent, without saying it only knows the conciliated ones", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: { arquivos: ARQUIVOS, total: 2 } });
    await renderizar();
    expect(screen.queryByText(/já entraram numa conciliação/)).not.toBeInTheDocument();
    expect(screen.queryByText(/enviados por último/)).not.toBeInTheDocument();
  });

  it("says when only the files sent last fit in the list", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: { arquivos: ARQUIVOS, total: 1200 } });
    await renderizar();

    const titulo = screen.getByRole("heading", { level: 1, name: "Extratos" });
    expect(titulo.nextElementSibling).toHaveTextContent("1.200 arquivos");
    expect(screen.getByText("Aparecem os 2 arquivos enviados por último, de 1.200.")).toBeInTheDocument();
  });

  it("invites the first upload when there is no file yet", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: { arquivos: [], total: 0 } });
    await renderizar();

    expect(screen.getByText("Nenhum extrato carregado ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fazer o primeiro upload" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.queryByRole("group", { name: "Filtrar arquivos" })).not.toBeInTheDocument();
  });

  it("asks for a reload when the backend fails", async () => {
    listarExtratos.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    await renderizar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível carregar os extratos. Recarregue a página e tente de novo.",
    );
  });

  it("sends an expired session back to the login", async () => {
    listarExtratos.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(ExtratosPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

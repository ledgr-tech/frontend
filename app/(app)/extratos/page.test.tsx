import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArquivoExtrato, Resultado } from "../conciliacoes/acoes";
import ExtratosPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const listarExtratos = vi.fn<() => Promise<Resultado<ArquivoExtrato[]>>>();
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
    erros: [],
  },
  {
    id: "s-set",
    nome: "erp-setembro.csv",
    origem: "sistema",
    conciliadoEm: "2026-09-24T17:02:11Z",
    resultado: "/conciliacoes/b-set",
    situacao: "concluido",
    lancamentos: 4203,
    erros: [],
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

  it("shows the files with a way to upload another one", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: ARQUIVOS });
    await renderizar();

    expect(screen.getByRole("heading", { level: 1, name: "Extratos carregados" })).toBeInTheDocument();
    expect(screen.getByText("2 arquivos · Telha Certa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Carregar arquivo" })).toHaveAttribute(
      "href",
      "/conciliacoes/nova",
    );
    expect(screen.getByRole("button", { name: /sicredi-setembro\.ofx/ })).toBeInTheDocument();
  });

  it("says which files the list covers, since the backend only knows them through conciliações", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: ARQUIVOS });
    await renderizar();
    expect(
      screen.getByText("Aparecem aqui os arquivos que já entraram numa conciliação."),
    ).toBeInTheDocument();
  });

  it("invites the first upload when there is no file yet", async () => {
    listarExtratos.mockResolvedValue({ ok: true, dados: [] });
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Execucao } from "@/lib/adaptadores";
import type { Resultado, VisaoGeral } from "../conciliacoes/acoes";
import AssistentePage from "./page";

const carregarVisaoGeral = vi.fn<() => Promise<Resultado<VisaoGeral>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarVisaoGeral: () => carregarVisaoGeral(),
  explicarDivergencia: vi.fn(),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn() }),
}));

const EXECUCAO = { id: "e1", executadaEm: "2026-09-24T17:02:11Z" } as Execucao;

describe("AssistentePage", () => {
  beforeEach(() => {
    carregarVisaoGeral.mockReset();
    redirect.mockClear();
  });

  it("opens the conversation about the latest conciliation", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: {
        execucoes: [EXECUCAO],
        total: 1,
        recente: {
          execucao: EXECUCAO,
          conciliacao: {
            id: "b",
            mes: "Setembro/2026",
            status: "em_andamento",
            linhas: [
              {
                id: "l1",
                descricao: "PIX",
                data: "04/09",
                valorBanco: 100,
                valorSistema: 100,
                status: "match_exato",
                explicacao: null,
                historico: [],
              },
            ],
          },
        },
        arquivosComLinhasNaoLidas: [],
      },
    });
    render(await AssistentePage());

    expect(screen.getByRole("heading", { level: 1, name: "Fale com o Ledgr" })).toBeInTheDocument();
    expect(screen.getByText("Assistente · conciliação de setembro")).toBeInTheDocument();
    expect(screen.getByRole("log", { name: "Conversa com o Ledgr" })).toHaveTextContent(
      "Setembro está 100,0% conciliado. Nada sobrou para revisar.",
    );
  });

  it("has nothing to talk about before the first conciliation", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
    });
    render(await AssistentePage());

    expect(screen.getByRole("heading", { name: "Ainda não há sobre o que conversar." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova conciliação" })).toHaveAttribute("href", "/conciliacoes/nova");
  });

  it("says so when the backend fails", async () => {
    carregarVisaoGeral.mockResolvedValue({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
    render(await AssistentePage());
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível abrir o assistente.");
  });

  it("sends an expired session to the login", async () => {
    carregarVisaoGeral.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    await expect(AssistentePage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

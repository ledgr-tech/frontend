import { beforeEach, describe, expect, it, vi } from "vitest";
import RevisaoPage from "./page";

const mocks = vi.hoisted(() => ({
  carregarRascunho: vi.fn(),
  recuperar: vi.fn(),
  redirecionar: vi.fn(),
  verificar: vi.fn(),
}));

vi.mock("../acoes", () => ({
  carregarRascunho: (id: string) => mocks.carregarRascunho(id),
  recuperarExtratoConfirmado: (id: string) => mocks.recuperar(id),
}));

vi.mock("../../../acoes", () => ({
  verificarNovaVersao: (...args: unknown[]) => mocks.verificar(...args),
}));

vi.mock("@/lib/rotas-servidor", () => ({
  redirecionarNoApp: (destino: string) => mocks.redirecionar(destino),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

describe("Página da revisão da importação via IA", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sem origem, o 409 do rascunho recupera o extrato e redireciona", async () => {
    mocks.carregarRascunho.mockResolvedValue({ ok: false, status: 409, erro: "Confirmada." });
    mocks.recuperar.mockResolvedValue({ ok: true, dados: { extratoId: "e1" } });

    await RevisaoPage({
      params: Promise.resolve({ id: "importacao-1" }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.recuperar).toHaveBeenCalledWith("importacao-1");
    expect(mocks.redirecionar).toHaveBeenCalledWith("/conciliacoes/nova?sistema=e1");
  });
});

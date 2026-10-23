import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Execucao } from "@/lib/adaptadores";
import type { Resultado, VisaoGeral } from "../conciliacoes/acoes";
import { PainelAssistente } from "./painel";

const carregarVisaoGeral = vi.fn<() => Promise<Resultado<VisaoGeral>>>();
vi.mock("../conciliacoes/acoes", () => ({
  carregarVisaoGeral: () => carregarVisaoGeral(),
  explicarDivergencia: vi.fn(),
}));

// o mesmo objeto a cada render, como o roteador do Next: o painel lê de novo se ele mudar
const push = vi.fn();
const roteador = { push };
vi.mock("next/navigation", () => ({ useRouter: () => roteador, usePathname: () => "/e/emp/visao-geral" }));
vi.mock("./acoes", () => ({ perguntarAoAssistente: vi.fn() }));

const EXECUCAO = { id: "e1", executadaEm: "2026-09-24T17:02:11Z" } as Execucao;

const COM_CONCILIACAO: Resultado<VisaoGeral> = {
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
};

function abrir(onFechar = vi.fn()) {
  render(<PainelAssistente id="painel" onFechar={onFechar} />);
  return screen.getByRole("dialog", { name: "Fale com o Ledgr" });
}

describe("PainelAssistente", () => {
  beforeEach(() => {
    carregarVisaoGeral.mockReset();
    push.mockReset();
  });

  it("reads the latest conciliation when it opens, and talks about it", async () => {
    carregarVisaoGeral.mockResolvedValue(COM_CONCILIACAO);
    const painel = abrir();

    expect(painel).toHaveTextContent("Lendo a última conciliação…");
    expect(await screen.findByRole("log", { name: "Conversa com o Ledgr" })).toHaveTextContent(
      "Setembro está 100,0% conciliado. Nada sobrou para revisar.",
    );
    expect(carregarVisaoGeral).toHaveBeenCalledOnce();
  });

  it("before the first conciliation, talks about using the Ledgr and points to a new conciliation", async () => {
    carregarVisaoGeral.mockResolvedValue({
      ok: true,
      dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
    });
    abrir();

    const conversa = await screen.findByRole("log", { name: "Conversa com o Ledgr" });
    expect(conversa).toHaveTextContent("Ainda não há conciliação para eu olhar, mas posso explicar como usar o Ledgr");
    expect(screen.getByRole("link", { name: "Nova conciliação" })).toHaveAttribute("href", "/conciliacoes/nova");
    expect(screen.getByRole("button", { name: "Como fecho o mês?" })).toBeInTheDocument();
  });

  it.each([
    ["the backend fails", () => carregarVisaoGeral.mockResolvedValue({ ok: false, status: 0, erro: "x" })],
    ["the call throws", () => carregarVisaoGeral.mockRejectedValue(new Error("Failed to fetch"))],
  ])("still answers how to use the Ledgr when %s", async (_, preparar) => {
    preparar();
    abrir();
    expect(await screen.findByRole("log", { name: "Conversa com o Ledgr" })).toHaveTextContent(
      "Não consegui ler a última conciliação agora",
    );
  });

  it("sends an expired session to the login", async () => {
    carregarVisaoGeral.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    abrir();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });

  it("closes on Escape and on its close button", async () => {
    carregarVisaoGeral.mockResolvedValue(COM_CONCILIACAO);
    const onFechar = vi.fn();
    const user = userEvent.setup();
    abrir(onFechar);

    await screen.findByRole("log", { name: "Conversa com o Ledgr" });
    await user.keyboard("{Escape}");
    expect(onFechar).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Fechar conversa" }));
    expect(onFechar).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { ConexaoIa, PALAVRA, TECLA, linhaDaConversa, quadroDaLanding } from "./conexao-ia";

vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useInView: () => true,
}));

function movimentoReduzido(reduzido: boolean) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: reduzido && consulta.includes("reduce"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a linha do tempo da conversa", () => {
  it("segue os tempos do canvas", () => {
    expect([TECLA, PALAVRA]).toEqual([85, 160]);
    expect(linhaDaConversa()).toEqual({
      menuIn: 2400, toggle: 3900, menuOut: 5100, dig1: 6000, dig1Fim: 8890, env1: 9790, cons1: 10690,
      resp1: 12990, resp1Fim: 15710, num1: 16210, divide: 18810, arroba: 21410, mencaoOk: 23210,
      dig2: 23810, dig2Fim: 25680, env2: 26580, cons2: 27480, resp2: 29780, resp2Fim: 32340, some: 37140, fim: 39140,
    });
  });

  it("a janela só se divide depois que o Claude termina de responder e mostra os números", () => {
    const L = linhaDaConversa();
    expect(quadroDaLanding(L.divide - 1).dividida).toBe(false);
    expect(quadroDaLanding(L.divide).dividida).toBe(true);
    expect(quadroDaLanding(L.num1 - 1).numeros).toBe(false);
    expect(quadroDaLanding(L.num1).numeros).toBe(true);
    expect(quadroDaLanding(L.resp1Fim).claude.resposta.every((p) => p.visivel)).toBe(true);
  });

  it("o Claude liga o Ledgr no menu de ferramentas antes de digitar", () => {
    const L = linhaDaConversa();
    expect(quadroDaLanding(L.toggle - 1).claude.ledgrLigado).toBe(false);
    expect(quadroDaLanding(L.toggle).claude).toMatchObject({ ledgrLigado: true, menuAberto: true });
    expect(quadroDaLanding(L.menuOut).claude.menuAberto).toBe(false);
    expect(quadroDaLanding(L.dig1Fim).claude.digitado).toBe("Como está a conciliação de agosto?");
    expect(quadroDaLanding(L.env1).claude.enviada).toBe("Como está a conciliação de agosto?");
  });

  it("o ChatGPT só recebe a pergunta depois de mencionar o Ledgr com @", () => {
    const L = linhaDaConversa();
    expect(quadroDaLanding(L.arroba).gpt.digitado).toBe("@");
    expect(quadroDaLanding(L.dig2 - 1).gpt.ledgrLigado).toBe(true);
    expect(quadroDaLanding(L.dig2 - 1).gpt.digitado).toBe("");
    expect(quadroDaLanding(L.resp2Fim).gpt.ferramenta).toBe("feito");
  });

  it("a volta some no fim, para recomeçar", () => {
    const L = linhaDaConversa();
    expect(quadroDaLanding(L.some - 1).some).toBe(false);
    expect(quadroDaLanding(L.some).some).toBe(true);
  });
});

describe("ConexaoIa", () => {
  it("o botão em destaque leva ao passo a passo da Central", () => {
    movimentoReduzido(false);
    render(<ConexaoIa />);
    expect(screen.getByRole("link", { name: /Ver como conectar/ })).toHaveAttribute("href", "/ajuda/conectar-ia");
    expect(screen.getByText("Simulação no Claude e no ChatGPT com os números do agosto da demonstração.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Pergunte à sua IA como está o seu mês.");
  });

  it("com movimento reduzido mostra as duas conversas inteiras, paradas", () => {
    movimentoReduzido(true);
    vi.useFakeTimers();
    const { container } = render(<ConexaoIa />);
    act(() => {});
    expect(vi.getTimerCount()).toBe(0);
    expect(container.querySelector(".cia-janela")).toHaveAttribute("data-dividida", "true");
    const palavras = container.querySelectorAll(".chat-ia-palavra");
    expect(palavras.length).toBeGreaterThan(30);
    expect(container.querySelectorAll(".chat-ia-palavra.visivel")).toHaveLength(palavras.length);
  });
});

describe("o HTML do servidor", () => {
  it("nasce no começo da volta, com a janela inteira do Claude", async () => {
    const { renderToString } = await import("react-dom/server");
    expect(renderToString(<ConexaoIa />)).toMatch(/cia-janela" data-dividida="false"/);
  });
});

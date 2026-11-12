import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { INICIO_DAS_CENAS, NOMES_DAS_CENAS, VOLTA, VideoDaConexao, quadroDoVideo } from "./video-da-conexao";

// o player só toca com o quadro na tela; aqui ele está sempre na tela
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

describe("quadroDoVideo", () => {
  it("cada cena começa no seu instante", () => {
    expect([0, 4999, 5000, 13500, 18500].map((t) => quadroDoVideo(t, "claude", "u").cena)).toEqual([0, 0, 1, 2, 3]);
    expect(INICIO_DAS_CENAS).toEqual([0, 5000, 13500, 18500]);
    expect(VOLTA).toBe(36000);
  });

  it("o botão Copiar vira Copiado na cena 0", () => {
    expect(quadroDoVideo(2399, "claude", "u").copiado).toBe(false);
    expect(quadroDoVideo(2400, "claude", "u").copiado).toBe(true);
  });

  it("na cena 1 a URL do conector é digitada inteira antes de confirmar", () => {
    const antes = quadroDoVideo(5000 + 2000, "claude", "https://api.x/mcp");
    expect(antes.modal.aberto).toBe(true);
    expect(antes.modal.url).toBe("");
    const q = quadroDoVideo(5000 + 5300, "claude", "https://api.x/mcp");
    expect(q.modal.nome).toBe("Ledgr");
    expect(q.modal.url).toBe("https://api.x/mcp");
    expect(q.modal.confirmou).toBe(true);
    expect(quadroDoVideo(5000 + 7200, "claude", "u").modal.conectou).toBe(true);
  });

  it("autoriza no Ledgr na cena 2", () => {
    expect(quadroDoVideo(13500 + 2299, "chatgpt", "u").autorizado).toBe(false);
    expect(quadroDoVideo(13500 + 2300, "chatgpt", "u").autorizado).toBe(true);
  });

  it("a resposta do Claude termina inteira antes da volta recomeçar", () => {
    const q = quadroDoVideo(VOLTA - 1, "claude", "u");
    expect(q.chat.enviada).toBe("Como está a conciliação de agosto?");
    expect(q.chat.resposta.every((p) => p.visivel)).toBe(true);
    expect(q.chat.resposta.map((p) => p.texto).join(" ")).toContain("157 ainda pedem revisão");
    expect(q.chat.ferramenta).toBe("feito");
  });

  it("no ChatGPT o Ledgr entra pela menção antes da pergunta", () => {
    const u3 = INICIO_DAS_CENAS[3];
    expect(quadroDoVideo(u3 + 1000, "chatgpt", "u").chat.menuAberto).toBe(true);
    expect(quadroDoVideo(u3 + 1000, "chatgpt", "u").chat.digitado).toBe("@");
    const depois = quadroDoVideo(u3 + 2100, "chatgpt", "u").chat;
    expect(depois.ledgrLigado).toBe(true);
    expect(depois.menuAberto).toBe(false);
    expect(quadroDoVideo(VOLTA - 1, "chatgpt", "u").chat.enviada).toBe("Agosto já foi fechado?");
  });
});

describe("VideoDaConexao", () => {
  it("toca, pausa e tem um botão por cena", async () => {
    movimentoReduzido(false);
    const user = userEvent.setup();
    render(<VideoDaConexao ia="chatgpt" endereco="https://api.x/mcp" />);
    const etapas = screen.getByRole("group", { name: "Etapas do vídeo" });
    expect(etapas.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: NOMES_DAS_CENAS[0] })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Pausar o vídeo" }));
    expect(screen.getByRole("button", { name: "Tocar o vídeo" })).toBeInTheDocument();
    expect(screen.getByText("O vídeo segue a IA escolhida no passo a passo.")).toBeInTheDocument();
  });

  it("troca de aba refaz a conversa na IA nova", async () => {
    movimentoReduzido(false);
    const user = userEvent.setup();
    const { container, rerender } = render(<VideoDaConexao ia="chatgpt" endereco="u" />);
    await user.click(screen.getByRole("button", { name: "4 · Perguntar" }));
    expect(container.querySelector(".vdc-cena-3 .chat-ia-gpt")).not.toBeNull();
    rerender(<VideoDaConexao ia="claude" endereco="u" />);
    expect(container.querySelector(".vdc-cena-3 .chat-ia-gpt")).toBeNull();
    expect(container.querySelector(".vdc-cena-3 .chat-ia-claude")).not.toBeNull();
    // a conversa recomeça do início da cena: nada enviado ainda
    expect(container.querySelector(".vdc-cena-3 .chat-ia-bolha")).toBeNull();
    expect(screen.getByRole("button", { name: "4 · Perguntar" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a aba Claude Code toca o vídeo do Claude", () => {
    movimentoReduzido(false);
    const { container } = render(<VideoDaConexao ia="claude-code" endereco="u" />);
    expect(screen.getByText(/No Claude Code, o passo 2 é o comando do terminal/)).toBeInTheDocument();
    expect(container.querySelector(".vdc-cena-1")?.textContent).toContain("Adicionar conector personalizado");
  });

  it("descreve os passos em texto para o leitor de tela e esconde o palco", () => {
    movimentoReduzido(false);
    const { container } = render(<VideoDaConexao ia="claude" endereco="u" />);
    expect(container.querySelector(".vdc-palco")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(/copia o endereço do conector em Configurações › Conexões/)).toBeInTheDocument();
  });

  it("com movimento reduzido mostra a conversa inteira, parada", () => {
    movimentoReduzido(true);
    vi.useFakeTimers();
    const { container } = render(<VideoDaConexao ia="claude" endereco="u" />);
    act(() => {});
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByRole("button", { name: "4 · Perguntar" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".vdc-cena-3 .chat-ia-palavra.visivel").length).toBeGreaterThan(10);
  });
});

describe("o HTML do servidor", () => {
  it("nasce na primeira cena, para a página não piscar a última ao hidratar", async () => {
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<VideoDaConexao ia="chatgpt" endereco="u" />);
    expect(html).toMatch(/vdc-cena-0" data-ligado="true"/);
    expect(html).toMatch(/vdc-cena-3" data-ligado="false"/);
  });
});

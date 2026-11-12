import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JanelaDaIa, JanelaDoChatGpt, JanelaDoClaude, type EstadoDoChat } from "./chat-de-ia";

const VAZIO: EstadoDoChat = {
  digitado: "",
  digitando: false,
  enviada: null,
  ferramenta: "nada",
  resposta: [],
  numeros: false,
  menuAberto: false,
  ledgrLigado: false,
};

describe("as janelas simuladas do Claude e do ChatGPT", () => {
  it("mostra o placeholder com o campo vazio e as letras quando há texto", () => {
    const { container, rerender } = render(<JanelaDoClaude estado={VAZIO} />);
    expect(screen.getByText("Como posso ajudar você hoje?")).toBeInTheDocument();
    rerender(<JanelaDoClaude estado={{ ...VAZIO, digitado: "Como", digitando: true }} />);
    expect(container.querySelectorAll(".letra")).toHaveLength(4);
    expect(screen.queryByText("Como posso ajudar você hoje?")).not.toBeInTheDocument();
  });

  it("depois do envio o Claude mostra a pergunta e troca o placeholder", () => {
    const { container } = render(<JanelaDoClaude estado={{ ...VAZIO, enviada: "Como está a conciliação de agosto?" }} />);
    expect(screen.getByText("Como está a conciliação de agosto?")).toBeInTheDocument();
    expect(screen.getByText("Responder ao Claude…")).toBeInTheDocument();
    // a saudação fica no DOM para esmaecer, mas apagada
    expect(container.querySelector(".chat-ia-saudacao")).toHaveAttribute("data-ligado", "false");
  });

  it("o Claude diz que está consultando o Ledgr e, depois, qual ferramenta usou", () => {
    const { rerender } = render(<JanelaDoClaude estado={{ ...VAZIO, enviada: "x", ferramenta: "consultando" }} />);
    expect(screen.getByText("Consultando o Ledgr")).toBeInTheDocument();
    rerender(<JanelaDoClaude estado={{ ...VAZIO, enviada: "x", ferramenta: "feito" }} />);
    expect(screen.getByText("Ledgr · Resumo do mês")).toBeInTheDocument();
  });

  it("o ChatGPT diz que usou o Ledgr quando a ferramenta termina", () => {
    render(<JanelaDoChatGpt estado={{ ...VAZIO, enviada: "Agosto já foi fechado?", ferramenta: "feito" }} />);
    expect(screen.getByText(/Usou o Ledgr/)).toBeInTheDocument();
    expect(screen.getByText("Pergunte alguma coisa")).toBeInTheDocument();
  });

  it("só a palavra visível da resposta ganha a classe de entrada", () => {
    const { container } = render(
      <JanelaDoClaude
        estado={{ ...VAZIO, enviada: "x", resposta: [{ texto: "Agosto", visivel: true }, { texto: "está", visivel: false }] }}
      />,
    );
    expect(container.querySelectorAll(".chat-ia-palavra.visivel")).toHaveLength(1);
  });

  it("a chave do Ledgr no menu do Claude acompanha o estado", () => {
    const { container } = render(<JanelaDoClaude estado={{ ...VAZIO, menuAberto: true, ledgrLigado: true }} />);
    expect(container.querySelector(".chat-ia-menu-ledgr .chat-ia-chave")).toHaveAttribute("data-ligado", "true");
  });

  it("escolhe a janela pela IA e esconde as duas do leitor de tela", () => {
    const { container, rerender } = render(<JanelaDaIa ia="chatgpt" estado={VAZIO} />);
    expect(container.querySelector(".chat-ia-gpt")).toHaveAttribute("aria-hidden", "true");
    rerender(<JanelaDaIa ia="claude" estado={VAZIO} />);
    expect(container.querySelector(".chat-ia-claude")).toHaveAttribute("aria-hidden", "true");
  });
});

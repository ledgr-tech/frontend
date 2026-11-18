import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PerguntasSugeridas } from "./perguntas-sugeridas";

afterEach(() => vi.restoreAllMocks());

describe("PerguntasSugeridas", () => {
  it("mostra as nove perguntas por tema e termina com o link para a Central", () => {
    render(<PerguntasSugeridas />);
    expect(screen.getByRole("heading", { name: "Perguntas que você pode fazer" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 5 }).map((titulo) => titulo.textContent))
      .toEqual(["Visão do mês", "Divergências", "Lançamentos", "Fechamento", "Resumo"]);
    expect(within(screen.getByRole("list", { name: "Visão do mês" })).getAllByRole("button")).toHaveLength(3);
    expect(within(screen.getByRole("list", { name: "Divergências" })).getAllByRole("button")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Copiar pergunta:/ })).toHaveLength(9);
    expect(screen.queryByText("Quais são as dez maiores divergências do mês?")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Central de ajuda/ })).toHaveAttribute("href", "/ajuda/conectar-ia#perguntar");
  });

  it("copia o texto exato com um clique e anuncia Copiado", async () => {
    const user = userEvent.setup();
    const escrever = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<PerguntasSugeridas />);
    const texto = "Como foi a conciliação de outubro?";
    const botao = screen.getByRole("button", { name: `Copiar pergunta: ${texto}` });

    await user.click(botao);

    expect(escrever).toHaveBeenCalledExactlyOnceWith(texto);
    expect(within(botao.closest("li")!).getByRole("status")).toHaveTextContent("Copiado");
  });

  it("permite alcançar o botão por Tab e copiar por Enter e Espaço", async () => {
    const user = userEvent.setup();
    const escrever = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<PerguntasSugeridas />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Copiar pergunta: Como foi a conciliação de outubro?" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Copiar pergunta: Como outubro se compara com setembro?" })).toHaveFocus();
    await user.keyboard(" ");

    expect(escrever.mock.calls).toEqual([["Como foi a conciliação de outubro?"], ["Como outubro se compara com setembro?"]]);
  });

  it("mostra o aviso só na última pergunta copiada", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<PerguntasSugeridas />);
    const primeira = screen.getByRole("button", { name: "Copiar pergunta: Como foi a conciliação de outubro?" });
    const segunda = screen.getByRole("button", { name: "Copiar pergunta: Como outubro se compara com setembro?" });

    await user.click(primeira);
    await user.click(segunda);

    expect(within(segunda.closest("li")!).getByRole("status")).toHaveTextContent("Copiado");
    expect(within(primeira.closest("li")!).getByRole("status")).toBeEmptyDOMElement();
  });

  it("informa a falha e mantém o texto disponível para copiar manualmente", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Sem permissão"));
    render(<PerguntasSugeridas />);
    const botao = screen.getByRole("button", { name: "Copiar pergunta: Como foi a conciliação de outubro?" });

    await user.click(botao);

    const linha = within(botao.closest("li")!);
    expect(linha.getByRole("status")).toHaveTextContent("Não foi possível copiar. Selecione a pergunta e copie o texto manualmente.");
    expect(linha.getByText("Como foi a conciliação de outubro?")).toBeInTheDocument();
    expect(linha.queryByText("Copiado")).not.toBeInTheDocument();
  });
});

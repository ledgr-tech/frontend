import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PAGINAS } from "../../../../(ajuda)/ajuda/paginas";
import type { ConexaoMcp } from "./acoes";
import { PainelDeConexoes } from "./painel";

const revogarConexaoMcp = vi.fn();
vi.mock("./acoes", () => ({ revogarConexaoMcp: (id: string) => revogarConexaoMcp(id) }));

const conexao: ConexaoMcp = {
  id: "c1",
  cliente: "ChatGPT",
  empresa: { id: "e1", razaoSocial: "Telha Certa Ltda" },
  criadaPor: "Ana",
  criadoEm: "2026-10-22T12:00:00Z",
  ultimoUsoEm: null,
  revogadaEm: null,
};

describe("PainelDeConexoes", () => {
  it("mostra o endereço do conector e cada conexão com a empresa que lê", () => {
    render(<PainelDeConexoes itens={[conexao]} endereco="https://api.ledgr.test/mcp" />);

    expect(screen.getByText("https://api.ledgr.test/mcp")).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "Conexões" });
    expect(lista).toHaveTextContent("ChatGPT");
    expect(lista).toHaveTextContent("Lê Telha Certa Ltda · só leitura");
    expect(lista).toHaveTextContent(/Autorizada por Ana em .* · ainda não usada/);
  });

  it("revoga depois de confirmar", async () => {
    revogarConexaoMcp.mockResolvedValue({ ok: true, dados: null });
    const user = userEvent.setup();
    render(<PainelDeConexoes itens={[conexao]} endereco={null} />);

    await user.click(screen.getByRole("button", { name: "Revogar" }));
    const confirmar = screen.getByRole("group", { name: "Revogar ChatGPT" });
    await user.click(within(confirmar).getByRole("button", { name: "Revogar" }));

    expect(revogarConexaoMcp).toHaveBeenCalledWith("c1");
    expect(await screen.findByText("Revogada")).toBeInTheDocument();
  });

  it("sem conexões, diz que não há e aponta os passos", () => {
    render(<PainelDeConexoes itens={[]} endereco={null} />);

    expect(screen.getByText("Nenhuma conexão ainda. Siga os passos acima e ela aparece aqui.")).toBeInTheDocument();
  });

  it("ensina a conectar, um assistente de cada vez, com o endereço para copiar", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<PainelDeConexoes itens={[]} endereco="https://api.ledgr.test/mcp" />);

    // o que ele lê e o que nunca vê vêm antes dos passos
    expect(screen.getByRole("heading", { name: "Como funciona" })).toBeInTheDocument();
    expect(screen.getByText(/Nunca vê a descrição dos lançamentos/)).toBeInTheDocument();

    // os menus são deles e mudam: cada assistente leva à sua documentação
    expect(screen.getByRole("list", { name: "Passos no ChatGPT" })).toHaveTextContent("Plugins");
    expect(screen.getByRole("link", { name: "documentação do ChatGPT" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://help.openai.com/"),
    );
    await user.click(screen.getByRole("button", { name: "Claude" }));
    expect(screen.getByRole("button", { name: "Claude" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("list", { name: "Passos no Claude" })).toHaveTextContent("Adicionar conector personalizado");
    expect(screen.getByRole("link", { name: "documentação do Claude" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://support.claude.com/"),
    );

        await user.click(screen.getByRole("button", { name: "Copiar o endereço do conector" }));
    expect(writeText).toHaveBeenCalledWith("https://api.ledgr.test/mcp");
    expect(screen.getByRole("button", { name: "Endereço do conector copiado" })).toBeInTheDocument();
  });

  it("leva à Política e à Central em outra aba, e o Claude Code ganha o comando pronto (#362)", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<PainelDeConexoes itens={[]} endereco="https://api.ledgr.test/mcp" />);

    expect(screen.getByRole("link", { name: "Política de privacidade" })).toHaveAttribute("href", "/privacidade#conexao-ia");
    const central = screen.getByRole("link", { name: "Central de ajuda" });
    expect(central).toHaveAttribute("href", "/ajuda/conectar-ia#passo-a-passo");
    expect(central).toHaveAttribute("target", "_blank");
    // a seção que o link abre existe: sem ela, o link cairia no alto da página
    const secoes = PAGINAS.find((pagina) => pagina.id === "configuracoes")?.funcoes.map((funcao) => funcao.id);
    expect(secoes).toContain("conexoes");

    // o comando é do Claude: com o ChatGPT escolhido, nem aparece
    expect(screen.queryByText("Usa o Claude Code, no terminal?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Claude" }));
    await user.click(screen.getByText("Usa o Claude Code, no terminal?"));
    const comando = "claude mcp add --transport http ledgr https://api.ledgr.test/mcp";
    expect(screen.getByText(comando)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar o comando" }));
    expect(writeText).toHaveBeenCalledWith(comando);
  });
});

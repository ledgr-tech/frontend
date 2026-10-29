import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("sem conexões, diz que não há", () => {
    render(<PainelDeConexoes itens={[]} endereco={null} />);

    expect(screen.getByText("Nenhuma conexão ainda.")).toBeInTheDocument();
  });
});

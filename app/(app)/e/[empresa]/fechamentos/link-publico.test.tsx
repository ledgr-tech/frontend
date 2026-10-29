import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkPublico } from "./link-publico";

const listar = vi.fn();
const criar = vi.fn();
const revogar = vi.fn();
vi.mock("./links", () => ({
  listarLinksDoRelatorio: (c: string) => listar(c),
  criarLinkDoRelatorio: (c: string, dias: number, origem: string) => criar(c, dias, origem),
  revogarLinkDoRelatorio: (c: string, id: string) => revogar(c, id),
}));

const LINK = { id: "11111111-1111-4111-8111-111111111111", prefixo: "k3Fq9aZx", criadoPor: "Maria", criadoEm: "2026-10-20T12:00:00Z", expiraEm: "2026-11-19T12:00:00Z", ultimoAcessoEm: "2026-10-22T09:10:00Z", acessos: 3, ativo: true };

describe("LinkPublico", () => {
  beforeEach(() => {
    listar.mockReset().mockResolvedValue({ ok: true, dados: [LINK] });
    criar.mockReset();
    revogar.mockReset();
  });

  it("lista os links ativos com validade e acessos", async () => {
    render(<LinkPublico competencia="2026-08" />);
    const tabela = await screen.findByRole("table", { name: "Links ativos" });
    expect(tabela).toHaveTextContent("k3Fq9aZx…");
    expect(tabela).toHaveTextContent("19/11/2026");
    expect(tabela).toHaveTextContent("último acesso em 22/10/2026");
  });

  it("gera o link com a validade escolhida e mostra o endereço uma vez", async () => {
    criar.mockResolvedValue({ ok: true, dados: { link: { ...LINK, id: "22222222-2222-4222-8222-222222222222", prefixo: "Zp81LmQe", acessos: 0, ultimoAcessoEm: null }, endereco: "https://app.exemplo/relatorio#abc" } });
    const user = userEvent.setup();
    render(<LinkPublico competencia="2026-08" />);
    await user.click(await screen.findByRole("button", { name: "90 dias" }));
    await user.click(screen.getByRole("button", { name: "Gerar link" }));
    expect(criar).toHaveBeenCalledWith("2026-08", 90, window.location.origin);
    expect(await screen.findByLabelText("Link público do relatório")).toHaveValue("https://app.exemplo/relatorio#abc");
    expect(screen.getByRole("table", { name: "Links ativos" })).toHaveTextContent("Zp81LmQe…");
  });

  it("revoga só depois da confirmação", async () => {
    revogar.mockResolvedValue({ ok: true, dados: null });
    const user = userEvent.setup();
    render(<LinkPublico competencia="2026-08" />);
    await user.click(await screen.findByRole("button", { name: "Revogar o link k3Fq9aZx" }));
    expect(revogar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar revogação" }));
    expect(revogar).toHaveBeenCalledWith("2026-08", LINK.id);
    expect(screen.queryByRole("table", { name: "Links ativos" })).not.toBeInTheDocument();
  });

  it("some quando o backend não tem a rota", async () => {
    listar.mockResolvedValue({ ok: false, status: 404, erro: "Not Found" });
    const { container } = render(<LinkPublico competencia="2026-08" />);
    await vi.waitFor(() => expect(listar).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

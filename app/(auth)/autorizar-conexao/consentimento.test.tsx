import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Resultado } from "../../(app)/e/[empresa]/conciliacoes/acoes";
import type { PedidoDeConexao } from "../../(app)/e/[empresa]/conexoes-mcp/acoes";
import { Consentimento } from "./consentimento";

const carregarPedidoDeConexao = vi.fn<(pedido: string) => Promise<Resultado<PedidoDeConexao>>>();
const autorizarConexao = vi.fn<(pedido: string, empresa: string) => Promise<Resultado<{ destino: string }>>>();
const recusarConexao = vi.fn<(pedido: string) => Promise<Resultado<{ destino: string }>>>();
vi.mock("../../(app)/e/[empresa]/conexoes-mcp/acoes", () => ({
  carregarPedidoDeConexao: (pedido: string) => carregarPedidoDeConexao(pedido),
  autorizarConexao: (pedido: string, empresa: string) => autorizarConexao(pedido, empresa),
  recusarConexao: (pedido: string) => recusarConexao(pedido),
}));

const TELHA = { id: "e-telha", razaoSocial: "Telha Certa Ltda", cnpj: "11222333000181" };
const OBRA = { id: "e-obra", razaoSocial: "Obra Firme Ltda", cnpj: "11444777000161" };

function pedido(extra: Partial<PedidoDeConexao> = {}): PedidoDeConexao {
  return {
    cliente: "Claude",
    origem: { host: "claude.ai", loopback: false },
    descricaoEscopo: "Ler o status das conciliações, as divergências por mês e os fechamentos de uma empresa.",
    expiraEm: "2026-10-23T13:10:00Z",
    empresas: [TELHA, OBRA],
    ...extra,
  };
}

const assign = vi.fn();
const localOriginal = window.location;

beforeEach(() => {
  carregarPedidoDeConexao.mockReset();
  autorizarConexao.mockReset();
  recusarConexao.mockReset();
  assign.mockReset();
  carregarPedidoDeConexao.mockResolvedValue({ ok: true, dados: pedido() });
  Object.defineProperty(window, "location", { configurable: true, value: { ...localOriginal, assign } });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: localOriginal });
});

function abrir(props: Partial<Parameters<typeof Consentimento>[0]> = {}) {
  render(<Consentimento pedido="Xy_9" email="ana@telhacerta.com.br" podeAutorizar {...props} />);
}

describe("Consentimento", () => {
  it("diz quem pede, de onde, o que poderá ler e com qual conta", async () => {
    abrir();

    expect(await screen.findByRole("heading", { name: "Conectar o Claude ao Ledgr" })).toBeInTheDocument();
    expect(screen.getByText("claude.ai")).toBeInTheDocument();
    expect(screen.getByText(/Você está no Ledgr como ana@telhacerta.com.br/)).toBeInTheDocument();
    expect(screen.getByText(/Ler o status das conciliações/)).toBeInTheDocument();
    expect(screen.getByText(/Só leitura/)).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(carregarPedidoDeConexao).toHaveBeenCalledWith("Xy_9");
  });

  it("avisa quando o pedido vem de um programa do próprio computador", async () => {
    carregarPedidoDeConexao.mockResolvedValue({ ok: true, dados: pedido({ origem: { host: "127.0.0.1", loopback: true } }) });
    abrir();

    expect(await screen.findByRole("note")).toHaveTextContent("programa no seu próprio computador");
  });

  it("com várias empresas, pede a escolha antes de autorizar e manda a escolhida", async () => {
    autorizarConexao.mockResolvedValue({ ok: true, dados: { destino: "https://claude.ai/api/mcp/auth_callback?code=c" } });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Autorizar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha a empresa");
    expect(autorizarConexao).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: /Obra Firme Ltda/ }));
    await user.click(screen.getByRole("button", { name: "Autorizar" }));

    expect(autorizarConexao).toHaveBeenCalledWith("Xy_9", OBRA.id);
    expect(assign).toHaveBeenCalledWith("https://claude.ai/api/mcp/auth_callback?code=c");
  });

  it("com uma empresa só, ela já vem marcada", async () => {
    carregarPedidoDeConexao.mockResolvedValue({ ok: true, dados: pedido({ empresas: [TELHA] }) });
    abrir();

    expect(await screen.findByRole("radio", { name: /Telha Certa Ltda/ })).toBeChecked();
  });

  it("recusar volta ao cliente com a recusa", async () => {
    recusarConexao.mockResolvedValue({ ok: true, dados: { destino: "https://claude.ai/cb?error=access_denied" } });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Recusar" }));

    expect(recusarConexao).toHaveBeenCalledWith("Xy_9");
    expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?error=access_denied");
  });

  it("o analista só recusa, e vê quem pode autorizar", async () => {
    abrir({ podeAutorizar: false });

    expect(await screen.findByRole("button", { name: "Recusar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Autorizar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Só o admin ou o gestor da conta autorizam");
  });

  it("o pedido vencido no meio (404) troca a tela pela de pedido indisponível", async () => {
    autorizarConexao.mockResolvedValue({ ok: false, status: 404, erro: "Este pedido de conexão não vale mais." });
    carregarPedidoDeConexao.mockResolvedValue({ ok: true, dados: pedido({ empresas: [TELHA] }) });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Autorizar" }));

    expect(await screen.findByRole("heading", { name: "Pedido indisponível." })).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("o limite de conexões (409) fica na tela, com os botões de volta", async () => {
    autorizarConexao.mockResolvedValue({ ok: false, status: 409, erro: "Sua conta já tem 10 conexões ativas." });
    carregarPedidoDeConexao.mockResolvedValue({ ok: true, dados: pedido({ empresas: [TELHA] }) });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Autorizar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("10 conexões ativas");
    expect(screen.getByRole("button", { name: "Autorizar" })).toBeEnabled();
  });

  it("sem pedido no endereço, nem chama o servidor", () => {
    abrir({ pedido: null });

    expect(screen.getByRole("heading", { name: "Pedido indisponível." })).toBeInTheDocument();
    expect(carregarPedidoDeConexao).not.toHaveBeenCalled();
  });
});

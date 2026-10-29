import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import type { Papel } from "@/lib/papel";
import { autorizarConexao, carregarConexoesMcp, carregarPedidoDeConexao, recusarConexao, revogarConexaoMcp } from "./acoes";

// a rede é a fronteira; ErroBackend e a tradução dos erros rodam de verdade
const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));
const conta = vi.hoisted(() => ({ papel: "admin" as Papel }));
vi.mock("../../../../(auth)/acoes", () => ({ contaDaSessao: async () => ({ papel: conta.papel }) }));

const PEDIDO = "Xy_9-abcDEF";
const EMPRESA = "5c0f2a8e-1b3d-4e6f-9a7b-2c4d6e8f0a1b";
const CONEXAO = "8e1d3c5b-7a9f-4b2d-8c6e-0f1a3b5c7d9e";
const VENCIDO = "Este pedido de conexão não vale mais. Volte ao ChatGPT ou ao Claude e conecte de novo.";

beforeEach(() => {
  chamarBackend.mockReset();
  emailDaSessao.mockResolvedValue("ana@x.com");
  conta.papel = "admin";
  vi.stubEnv("LEDGR_API_URL", "https://api.ledgr.test/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("carregarPedidoDeConexao", () => {
  it("adapta o pedido para a tela", async () => {
    chamarBackend.mockResolvedValueOnce({
      cliente: "Claude",
      origem: { host: "claude.ai", loopback: false },
      escopo: "ledgr.leitura",
      descricao_escopo: "Ler o status das conciliações.",
      expira_em: "2026-10-23T13:10:00Z",
      empresas: [{ id: EMPRESA, razao_social: "Telha Certa Ltda", cnpj: "11222333000181" }],
    });

    expect(await carregarPedidoDeConexao(PEDIDO)).toEqual({
      ok: true,
      dados: {
        cliente: "Claude",
        origem: { host: "claude.ai", loopback: false },
        descricaoEscopo: "Ler o status das conciliações.",
        expiraEm: "2026-10-23T13:10:00Z",
        empresas: [{ id: EMPRESA, razaoSocial: "Telha Certa Ltda", cnpj: "11222333000181" }],
      },
    });
    expect(chamarBackend).toHaveBeenCalledWith(`/conexoes-mcp/pedidos/${PEDIDO}`);
  });

  it("pedido vencido ou já usado (404) diz para conectar de novo", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Pedido de conexão não encontrado ou expirado."));

    expect(await carregarPedidoDeConexao(PEDIDO)).toEqual({ ok: false, status: 404, erro: VENCIDO });
  });

  it("não manda ao backend um pedido fora do formato", async () => {
    expect(await carregarPedidoDeConexao("../me")).toMatchObject({ status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("autorizarConexao", () => {
  it("manda a empresa e devolve o endereço de volta do cliente", async () => {
    chamarBackend.mockResolvedValueOnce({ redirecionar_para: "https://claude.ai/api/mcp/auth_callback?code=c&state=s&iss=i" });

    expect(await autorizarConexao(PEDIDO, EMPRESA)).toEqual({
      ok: true,
      dados: { destino: "https://claude.ai/api/mcp/auth_callback?code=c&state=s&iss=i" },
    });
    expect(chamarBackend).toHaveBeenCalledWith(`/conexoes-mcp/pedidos/${PEDIDO}/aprovar`, {
      method: "POST",
      corpo: { empresa_id: EMPRESA },
    });
  });

  it("não leva o navegador a um endereço que não seja http(s)", async () => {
    chamarBackend.mockResolvedValueOnce({ redirecionar_para: "javascript:alert(1)" });

    expect(await autorizarConexao(PEDIDO, EMPRESA)).toMatchObject({ ok: false, status: 502 });
  });

  it("a empresa de outra conta (404) vira 422, para a tela pedir outra", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Empresa não encontrada."));

    expect(await autorizarConexao(PEDIDO, EMPRESA)).toEqual({ ok: false, status: 422, erro: "Empresa não encontrada." });
  });

  it("o limite de 10 conexões (409) chega com o texto do backend", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(409, "Sua conta já tem 10 conexões ativas. Revogue uma antes de criar outra."));

    expect(await autorizarConexao(PEDIDO, EMPRESA)).toMatchObject({ status: 409, erro: expect.stringContaining("10 conexões") });
  });

  it("o analista e a demonstração não autorizam, sem chamar o backend", async () => {
    conta.papel = "analista";
    expect(await autorizarConexao(PEDIDO, EMPRESA)).toMatchObject({ ok: false, status: 403 });

    conta.papel = "gestor";
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "ana@x.com");
    expect(await autorizarConexao(PEDIDO, EMPRESA)).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("sem empresa válida não chama o backend", async () => {
    expect(await autorizarConexao(PEDIDO, "")).toMatchObject({ status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("recusarConexao", () => {
  it("o analista também recusa, e volta ao cliente com a recusa", async () => {
    conta.papel = "analista";
    chamarBackend.mockResolvedValueOnce({ redirecionar_para: "https://chatgpt.com/connector_platform_oauth_redirect?error=access_denied" });

    expect(await recusarConexao(PEDIDO)).toEqual({
      ok: true,
      dados: { destino: "https://chatgpt.com/connector_platform_oauth_redirect?error=access_denied" },
    });
    expect(chamarBackend).toHaveBeenCalledWith(`/conexoes-mcp/pedidos/${PEDIDO}/recusar`, { method: "POST" });
  });
});

describe("carregarConexoesMcp", () => {
  it("adapta as conexões e diz o endereço do conector", async () => {
    chamarBackend.mockResolvedValueOnce({
      itens: [
        {
          id: CONEXAO,
          cliente: "Claude",
          empresa: { id: EMPRESA, razao_social: "Telha Certa Ltda" },
          criada_por: "Ana",
          criado_em: "2026-10-22T12:00:00Z",
          ultimo_uso_em: null,
          revogada_em: null,
        },
      ],
    });

    expect(await carregarConexoesMcp()).toEqual({
      ok: true,
      dados: {
        itens: [
          {
            id: CONEXAO,
            cliente: "Claude",
            empresa: { id: EMPRESA, razaoSocial: "Telha Certa Ltda" },
            criadaPor: "Ana",
            criadoEm: "2026-10-22T12:00:00Z",
            ultimoUsoEm: null,
            revogadaEm: null,
          },
        ],
        endereco: "https://api.ledgr.test/mcp",
      },
    });
  });

  it("com a conexão desligada no backend (404), o 404 chega à tela", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found"));

    expect(await carregarConexoesMcp()).toMatchObject({ ok: false, status: 404 });
  });

  it("o analista não lê as conexões", async () => {
    conta.papel = "analista";

    expect(await carregarConexoesMcp()).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("revogarConexaoMcp", () => {
  it("revoga pelo id, e não manda id sem formato", async () => {
    chamarBackend.mockResolvedValueOnce(undefined);

    expect(await revogarConexaoMcp(CONEXAO)).toEqual({ ok: true, dados: null });
    expect(chamarBackend).toHaveBeenCalledWith(`/conexoes-mcp/${CONEXAO}`, { method: "DELETE" });
    expect(await revogarConexaoMcp("../x")).toMatchObject({ status: 404 });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
  });
});

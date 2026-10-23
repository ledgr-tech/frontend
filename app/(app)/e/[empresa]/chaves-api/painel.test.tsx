import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import type { Resultado } from "../conciliacoes/acoes";
import type { ChaveApi, ChavesDaApi } from "./acoes";
import { PainelDeChavesApi } from "./painel";

const carregarChavesApi = vi.fn<() => Promise<Resultado<ChavesDaApi>>>();
const criarChaveApi = vi.fn<(nome: string, empresaId: string | null) => Promise<Resultado<{ chave: ChaveApi; token: string }>>>();
const revogarChaveApi = vi.fn<(id: string) => Promise<Resultado<null>>>();
vi.mock("./acoes", () => ({
  carregarChavesApi: () => carregarChavesApi(),
  criarChaveApi: (nome: string, empresaId: string | null) => criarChaveApi(nome, empresaId),
  revogarChaveApi: (id: string) => revogarChaveApi(id),
}));

const TELHA = { id: "e-telha", razaoSocial: "Telha Certa Ltda", cnpj: "11222333000181" };
const OBRA = { id: "e-obra", razaoSocial: "Obra Firme Ltda", cnpj: "11444777000161" };

const chave: ChaveApi = {
  id: "k1",
  nome: "Planilha do financeiro",
  prefixo: "Ab12Cd34",
  empresa: { id: TELHA.id, razaoSocial: TELHA.razaoSocial },
  criadaPor: "Ana",
  criadoEm: "2026-10-22T12:00:00Z",
  ultimoUsoEm: null,
  revogadaEm: null,
};

function abrir() {
  render(
    <ProvedorDaEmpresa ativa={TELHA} empresas={[TELHA, OBRA]}>
      <PainelDeChavesApi />
    </ProvedorDaEmpresa>,
  );
}

beforeEach(() => {
  carregarChavesApi.mockReset();
  criarChaveApi.mockReset();
  revogarChaveApi.mockReset();
  carregarChavesApi.mockResolvedValue({ ok: true, dados: { itens: [chave], endereco: "https://api.ledgr.test" } });
});

describe("PainelDeChavesApi", () => {
  it("lista as chaves com o prefixo, o escopo e o uso, e liga a documentação", async () => {
    abrir();

    const lista = await screen.findByRole("list", { name: "Chaves da API" });
    expect(within(lista).getByText("Planilha do financeiro")).toBeInTheDocument();
    expect(within(lista).getByText("ledgr_Ab12Cd34…")).toBeInTheDocument();
    expect(lista).toHaveTextContent("Telha Certa Ltda");
    expect(lista).toHaveTextContent(/Criada por Ana em .* · nunca usada/);
    expect(screen.getByRole("link", { name: "OpenAPI" })).toHaveAttribute("href", "https://api.ledgr.test/v1/openapi.json");
    expect(screen.getByRole("link", { name: "llms.txt" })).toHaveAttribute("href", "https://api.ledgr.test/llms.txt");
  });

  it("cria a chave da empresa ativa por padrão e mostra o token uma vez só", async () => {
    criarChaveApi.mockResolvedValue({
      ok: true,
      dados: { chave: { ...chave, id: "k2", nome: "Power BI" }, token: "ledgr_novo-token" },
    });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Criar chave" }));
    expect(screen.getByLabelText("Empresas que a chave lê")).toHaveValue(TELHA.id);
    await user.type(screen.getByLabelText("Nome"), "Power BI");
    await user.click(screen.getByRole("button", { name: "Criar chave" }));

    expect(criarChaveApi).toHaveBeenCalledWith("Power BI", TELHA.id);
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("Chave “Power BI” criada");
    expect(within(aviso).getByText("ledgr_novo-token")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await user.click(within(aviso).getByRole("button", { name: "Já guardei" }));
    expect(screen.queryByText("ledgr_novo-token")).not.toBeInTheDocument();
  });

  it("sem permissão de copiar, deixa a chave selecionada e diz para usar Ctrl+C", async () => {
    criarChaveApi.mockResolvedValue({ ok: true, dados: { chave, token: "ledgr_t" } });
    const user = userEvent.setup();
    abrir();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("negado")) },
    });

    await user.click(await screen.findByRole("button", { name: "Criar chave" }));
    await user.type(screen.getByLabelText("Nome"), "Planilha");
    await user.click(screen.getByRole("button", { name: "Criar chave" }));
    await user.click(screen.getByRole("button", { name: "Copiar chave" }));

    expect(await screen.findByText(/use Ctrl\+C/)).toBeInTheDocument();
    expect(window.getSelection()?.toString()).toBe("ledgr_t");
  });

  it("todas as empresas da conta vai sem empresa", async () => {
    criarChaveApi.mockResolvedValue({ ok: true, dados: { chave: { ...chave, empresa: null }, token: "ledgr_t" } });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Criar chave" }));
    await user.type(screen.getByLabelText("Nome"), "Integração");
    await user.selectOptions(screen.getByLabelText("Empresas que a chave lê"), "Todas as empresas da conta");
    await user.click(screen.getByRole("button", { name: "Criar chave" }));

    expect(criarChaveApi).toHaveBeenCalledWith("Integração", null);
  });

  it("sem nome não chama o servidor, e o erro do servidor fica no formulário", async () => {
    criarChaveApi.mockResolvedValue({ ok: false, status: 409, erro: "Sua conta já tem 10 chaves ativas. Revogue uma antes de criar outra." });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Criar chave" }));
    await user.click(screen.getByRole("button", { name: "Criar chave" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Dê um nome à chave");
    expect(criarChaveApi).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Nome"), "Mais uma");
    await user.click(screen.getByRole("button", { name: "Criar chave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("10 chaves ativas");
  });

  it("revoga depois de confirmar, e a chave fica na lista como revogada", async () => {
    revogarChaveApi.mockResolvedValue({ ok: true, dados: null });
    const user = userEvent.setup();
    abrir();

    await user.click(await screen.findByRole("button", { name: "Revogar" }));
    const confirmar = screen.getByRole("group", { name: "Revogar Planilha do financeiro" });
    expect(confirmar).toHaveTextContent("perde o acesso na hora");
    await user.click(within(confirmar).getByRole("button", { name: "Revogar" }));

    expect(revogarChaveApi).toHaveBeenCalledWith("k1");
    expect(await screen.findByText("Revogada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar" })).not.toBeInTheDocument();
  });

  it("com 10 ativas o botão de criar desliga e diz por quê", async () => {
    carregarChavesApi.mockResolvedValue({
      ok: true,
      dados: { itens: Array.from({ length: 10 }, (_, i) => ({ ...chave, id: `k${i}` })), endereco: null },
    });
    abrir();

    expect(await screen.findByRole("button", { name: "Criar chave" })).toBeDisabled();
    expect(screen.getByText(/já tem 10 chaves ativas/)).toBeInTheDocument();
  });

  it("um backend sem a rota (404) diz que a API ainda não está disponível", async () => {
    carregarChavesApi.mockResolvedValue({ ok: false, status: 404, erro: "Not Found" });
    abrir();

    expect(await screen.findByText("A API pública ainda não está disponível nesta conta.")).toBeInTheDocument();
  });
});

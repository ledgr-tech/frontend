import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { EmpresaCliente } from "@/lib/adaptadores";
import type { Resultado } from "../conciliacoes/acoes";
import EmpresasPage from "./page";

// quem fala com o backend é a action; aqui ela só devolve o que ele responderia
const carregarEmpresas = vi.fn<() => Promise<Resultado<EmpresaCliente[]>>>();
vi.mock("./acoes", () => ({
  carregarEmpresas: () => carregarEmpresas(),
  cadastrarEmpresa: vi.fn(),
}));
vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: async () => true }));

const redirecionar = vi.fn();
vi.mock("@/lib/rotas-servidor", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso
  redirecionarNoApp: async (destino: string) => {
    redirecionar(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/e/x/empresas" }));

const A: EmpresaCliente = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181", cnpjVerificado: true, criadaEm: "2026-10-08T17:59:02Z" };
const B: EmpresaCliente = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-21T19:48:16Z" };

async function abrir() {
  render(await EmpresasPage());
}

beforeEach(() => {
  vi.clearAllMocks();
  carregarEmpresas.mockResolvedValue({ ok: true, dados: [A, B] });
});

describe("a tela Empresas", () => {
  it("mostra as empresas da conta em tabela, sob o mesmo título do menu", async () => {
    await abrir();

    expect(screen.getByRole("heading", { level: 1, name: "Empresas" })).toBeInTheDocument();
    expect(screen.getByText("2 empresas")).toBeInTheDocument();
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("Padaria Ltda")).toBeInTheDocument();
    expect(within(tabela).getByText("11.444.777/0001-61")).toBeInTheDocument();
    expect(within(tabela).getAllByRole("row")).toHaveLength(3); // cabeçalho e duas empresas
  });

  it("com uma empresa só, o contexto fala no singular", async () => {
    carregarEmpresas.mockResolvedValue({ ok: true, dados: [A] });
    await abrir();

    expect(screen.getByText("1 empresa")).toBeInTheDocument();
  });

  it("sessão vencida leva ao login", async () => {
    carregarEmpresas.mockResolvedValue({ ok: false, status: 401, erro: "x" });

    await expect(EmpresasPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirecionar).toHaveBeenCalledWith("/login");
  });

  it("sem a rota (404, backend anterior ao #143) diz que ainda não existe", async () => {
    carregarEmpresas.mockResolvedValue({ ok: false, status: 404, erro: "Not Found" });
    await abrir();

    expect(screen.getByText("As empresas ainda não estão disponíveis.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("outra falha avisa e pede para recarregar", async () => {
    carregarEmpresas.mockResolvedValue({ ok: false, status: 500, erro: "x" });
    await abrir();

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar as empresas. Recarregue a página e tente de novo.");
  });
});

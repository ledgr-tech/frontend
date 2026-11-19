import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Children, isValidElement } from "react";
import { ErroBackend } from "@/lib/backend";
import AdminPage from "./page";
import EstadosPage from "./estados/page";
import PagamentosPage from "./pagamentos/page";
import CancelamentosPage from "./cancelamentos/page";
import VencimentosPage from "./vencimentos/page";
import ContaPage from "./[conta]/page";
import PagamentosDaContaPage from "./[conta]/pagamentos/page";
import { buscarContas } from "./acoes";
import { COOKIE_DA_BUSCA } from "./situacao";

const { chamarBackend, lerCookie, redirecionar, naoEncontrado } = vi.hoisted(() => ({
  chamarBackend: vi.fn(), lerCookie: vi.fn(), redirecionar: vi.fn(), naoEncontrado: vi.fn(),
}));
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: lerCookie }) }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    redirecionar(destino);
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    naoEncontrado();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const ID = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const PAGINAS = [
  { nome: "/admin", abrir: () => AdminPage({ searchParams: Promise.resolve({}) }) },
  { nome: "/admin/estados", abrir: () => EstadosPage() },
  { nome: "/admin/pagamentos", abrir: () => PagamentosPage({ searchParams: Promise.resolve({}) }) },
  { nome: "/admin/cancelamentos", abrir: () => CancelamentosPage({ searchParams: Promise.resolve({}) }) },
  { nome: "/admin/vencimentos", abrir: () => VencimentosPage({ searchParams: Promise.resolve({}) }) },
  { nome: "/admin/[conta]", abrir: () => ContaPage({ params: Promise.resolve({ conta: ID }) }) },
  { nome: "/admin/[conta]/pagamentos", abrir: () => PagamentosDaContaPage({ params: Promise.resolve({ conta: ID }), searchParams: Promise.resolve({}) }) },
];

beforeEach(() => {
  chamarBackend.mockReset();
  lerCookie.mockReset();
  redirecionar.mockReset();
  naoEncontrado.mockReset();
});

describe("acesso às páginas do painel", () => {
  it.each(PAGINAS)("$nome responde 404 ao 403 do backend", async ({ abrir }) => {
    chamarBackend.mockRejectedValue(new ErroBackend(403, "Acesso restrito à equipe do Ledgr."));
    await expect(abrir()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(chamarBackend).toHaveBeenCalled();
    expect(naoEncontrado).toHaveBeenCalledExactlyOnceWith();
    expect(redirecionar).not.toHaveBeenCalled();
  });

  it.each(PAGINAS)("$nome pede login ao 401 do backend", async ({ abrir }) => {
    chamarBackend.mockRejectedValue(new ErroBackend(401, "Sessão expirada."));
    await expect(abrir()).rejects.toThrow("NEXT_REDIRECT");
    expect(chamarBackend).toHaveBeenCalled();
    expect(redirecionar).toHaveBeenCalledExactlyOnceWith("/login");
    expect(naoEncontrado).not.toHaveBeenCalled();
  });
});

describe("busca de contas sem dados pessoais na URL", () => {
  it("usa o cookie no backend e no campo, ignora ?busca= antigo e mantém só filtros na paginação", async () => {
    lerCookie.mockImplementation((nome: string) => nome === COOKIE_DA_BUSCA ? { value: "financeiro@cliente.test" } : undefined);
    chamarBackend.mockResolvedValue({
      total: 21, limit: 20, offset: 0,
      itens: [{ id: ID, razao_social: "Empresa de teste", cnpj: "00000000000000", plano: null, situacao: "teste", teste_termina_em: null, assinatura_ativa: false, inativa: false, criada_em: "2026-11-01T00:00:00Z" }],
    });
    const arvore = await AdminPage({ searchParams: Promise.resolve({ busca: "url-antiga@cliente.test", situacao: "teste", ordem: "teste_termina_em", uf: "RS", com_busca: "1" }) });
    render(arvore);

    expect(lerCookie).toHaveBeenCalledWith(COOKIE_DA_BUSCA);
    const consulta = new URL(chamarBackend.mock.calls[0][0], "https://ledgr.test").searchParams;
    expect(consulta.get("busca")).toBe("financeiro@cliente.test");
    expect(screen.getByRole("searchbox", { name: "Buscar conta" })).toHaveValue("financeiro@cliente.test");
    expect(screen.getByRole("searchbox", { name: "Buscar conta" })).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute("href", "/admin?situacao=teste&ordem=teste_termina_em&uf=RS&com_busca=1&pagina=2");
    // a Server Action é a action do formulário; os botões continuam escolhendo a situação.
    const formulario = Children.toArray(arvore.props.children).find((filho) => isValidElement(filho) && filho.type === "form");
    expect(isValidElement<{ action: unknown }>(formulario) && formulario.props.action).toBe(buscarContas);
    expect(screen.getByRole("search")).not.toHaveAttribute("method");
    expect(screen.getByRole("button", { name: "Buscar" })).toHaveAttribute("name", "situacao");
  });

  it("sem cookie, ignora a busca de um link antigo mesmo com o marcador", async () => {
    chamarBackend.mockResolvedValue({ total: 0, limit: 20, offset: 0, itens: [] });
    render(await AdminPage({ searchParams: Promise.resolve({ busca: "url-antiga@cliente.test", pagina: "1", com_busca: "1" }) }));
    const consulta = new URL(chamarBackend.mock.calls[0][0], "https://ledgr.test").searchParams;
    expect(consulta.has("busca")).toBe(false);
    expect(screen.getByRole("searchbox", { name: "Buscar conta" })).toHaveValue("");
  });

  it.each([undefined, "", "0", "true"])("com cookie e sem marcador válido (%s), abre sem a busca guardada", async (com_busca) => {
    lerCookie.mockReturnValue({ value: "financeiro@cliente.test" });
    chamarBackend.mockResolvedValue({
      total: 21, limit: 20, offset: 0,
      itens: [{ id: ID, razao_social: "Empresa de teste", cnpj: "00000000000000", plano: null, situacao: "teste", teste_termina_em: null, assinatura_ativa: false, inativa: false, criada_em: "2026-11-01T00:00:00Z" }],
    });
    render(await AdminPage({ searchParams: Promise.resolve({ uf: "RS", com_busca, busca: "url-antiga@cliente.test" }) }));
    const consulta = new URL(chamarBackend.mock.calls[0][0], "https://ledgr.test").searchParams;
    expect(consulta.has("busca")).toBe(false);
    expect(consulta.get("uf")).toBe("RS");
    expect(screen.getByRole("searchbox", { name: "Buscar conta" })).toHaveValue("");
    expect(screen.getByRole("searchbox", { name: "Buscar conta" })).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute("href", "/admin?uf=RS&pagina=2");
  });
});

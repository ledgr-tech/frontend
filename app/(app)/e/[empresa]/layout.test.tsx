import { describe, it, expect, vi, beforeEach } from "vitest";
import AppLayout from "./layout";

const A = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const B = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const params = Promise.resolve({ empresa: A });
const EMPRESAS = [
  { id: A, razaoSocial: "Padaria Ltda", cnpj: "11222333000181" },
  { id: B, razaoSocial: "Mercado Ltda", cnpj: "11444777000161" },
];
/** O Shell dentro do provedor da empresa: o que o layout devolve. */
const shell = (elemento: { props: { children: { props: Record<string, unknown> } } }) => elemento.props.children.props;

const auth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => auth(),
}));

const redirect = vi.fn();
const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    notFound();
    throw new Error("NEXT_NOT_FOUND");
  },
  // o redirect do Next interrompe a renderização lançando; o mock imita isso,
  // senão o teste seguiria para um caminho que na vida real nunca roda
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

const contaDaSessao = vi.fn();
vi.mock("../../../(auth)/acoes", () => ({ contaDaSessao: () => contaDaSessao() }));

vi.mock("./shell", () => ({
  Shell: ({ email, children }: { email: string; children: React.ReactNode }) => (
    <div data-email={email}>{children}</div>
  ),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    auth.mockReset();
    redirect.mockClear();
    notFound.mockClear();
    contaDaSessao.mockReset();
    contaDaSessao.mockResolvedValue({ empresa: "", temSenha: true, empresas: [], preferencias: null, assinatura: null });
  });

  it("manda para o login quando não há sessão", async () => {
    auth.mockResolvedValue(null);
    // a checagem é no servidor: a página protegida nem chega a ser montada
    await expect(AppLayout({ children: "conteúdo", params })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("manda para o login quando a sessão veio sem e-mail", async () => {
    auth.mockResolvedValue({ user: {} });
    await expect(AppLayout({ children: "conteúdo", params })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("entrega o e-mail da sessão para o shell", async () => {
    auth.mockResolvedValue({ user: { email: "financeiro@telhacerta.com.br" } });
    const elemento = await AppLayout({ children: "conteúdo", params });
    expect(redirect).not.toHaveBeenCalled();
    expect(shell(elemento).email).toBe("financeiro@telhacerta.com.br");
  });

  it("entrega as preferências da conta para o shell, null quando o /me não manda", async () => {
    auth.mockResolvedValue({ user: { email: "financeiro@telhacerta.com.br" } });
    const elemento = await AppLayout({ children: "conteúdo", params });
    expect(shell(elemento).preferencias).toBeNull();
  });

  it("entrega ao shell o papel da pessoa", async () => {
    auth.mockResolvedValue({ user: { email: "financeiro@telhacerta.com.br" } });
    contaDaSessao.mockResolvedValue({
      empresa: "Telha Certa Ltda",
      temSenha: true,
      papel: "gestor",
      empresas: [],
      preferencias: null,
      assinatura: null,
    });
    const elemento = await AppLayout({ children: "conteúdo", params });
    expect(shell(elemento).papel).toBe("gestor");
  });

  it("conta sem plano vai escolher o plano antes", async () => {
    auth.mockResolvedValue({ user: { email: "financeiro@telhacerta.com.br" } });
    contaDaSessao.mockResolvedValue({
      empresa: "Telha Certa Ltda",
      temSenha: true,
      empresas: [],
      preferencias: null,
      assinatura: { situacao: "sem_plano", plano: null, testeTerminaEm: null },
    });
    await expect(AppLayout({ children: "conteúdo", params })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/plano");
  });

  it("em teste ou sem a informação, entra normalmente", async () => {
    auth.mockResolvedValue({ user: { email: "financeiro@telhacerta.com.br" } });
    contaDaSessao.mockResolvedValue({
      empresa: "Telha Certa Ltda",
      temSenha: true,
      empresas: [],
      preferencias: null,
      assinatura: { situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29" },
    });
    await AppLayout({ children: "conteúdo", params });
    expect(redirect).not.toHaveBeenCalled();
  });

  describe("a empresa da URL (#169)", () => {
    const sessao = { user: { email: "financeiro@telhacerta.com.br" } };
    const conta = (empresas: typeof EMPRESAS | []) => ({
      empresa: "Escritório Contábil Ltda",
      temSenha: true,
      papel: "admin",
      empresas,
      preferencias: null,
      assinatura: null,
    });

    it("um segmento que não é UUID dá 404, sem nem falar com o backend", async () => {
      auth.mockResolvedValue(sessao);
      await expect(AppLayout({ children: "x", params: Promise.resolve({ empresa: "abc" }) })).rejects.toThrow("NEXT_NOT_FOUND");
      expect(contaDaSessao).not.toHaveBeenCalled();
    });

    it("um UUID que não é de empresa da conta dá 404", async () => {
      auth.mockResolvedValue(sessao);
      contaDaSessao.mockResolvedValue(conta(EMPRESAS));
      await expect(AppLayout({ children: "x", params: Promise.resolve({ empresa: "5a5a5a5a-1b2c-4d3e-8f4a-0b1c2d3e4f5a" }) })).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    });

    it("sem a lista de empresas (backend anterior ao #133, ou o /me fora do ar), aceita o UUID e segue", async () => {
      auth.mockResolvedValue(sessao);
      contaDaSessao.mockResolvedValue(conta([]));
      const elemento = await AppLayout({ children: "x", params });
      expect(notFound).not.toHaveBeenCalled();
      expect(elemento.props.ativa).toEqual({ id: A, razaoSocial: "Escritório Contábil Ltda", cnpj: "" });
      expect(elemento.props.empresas).toEqual([elemento.props.ativa]);
    });

    it("com a empresa da conta, entrega a ativa e as demais ao provedor, e os nomes ao shell", async () => {
      auth.mockResolvedValue(sessao);
      contaDaSessao.mockResolvedValue(conta(EMPRESAS));
      const elemento = await AppLayout({ children: "x", params: Promise.resolve({ empresa: B }) });
      expect(elemento.props.ativa).toEqual(EMPRESAS[1]);
      expect(elemento.props.empresas).toEqual(EMPRESAS);
      // o cabeçalho das telas mostra a empresa ativa; o cartão do usuário, a conta (o escritório)
      expect(shell(elemento).empresa).toBe("Mercado Ltda");
      expect(shell(elemento).nomeDaConta).toBe("Escritório Contábil Ltda");
    });

    it("sem sessão, o login vem antes de qualquer conferência da empresa", async () => {
      auth.mockResolvedValue(null);
      await expect(AppLayout({ children: "x", params: Promise.resolve({ empresa: "abc" }) })).rejects.toThrow("NEXT_REDIRECT");
      expect(notFound).not.toHaveBeenCalled();
    });
  });
});

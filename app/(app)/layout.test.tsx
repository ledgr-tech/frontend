import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppLayout from "./layout";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard",
}));

const getSession = vi.fn();
const logout = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
  logout: () => logout(),
}));

const avisosLidos = vi.fn();
const marcarAvisosLidos = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  EMPRESA_MOCK: "Telha Certa",
  AVISOS: [
    {
      id: "a1",
      titulo: "Extrato de outubro disponível no banco",
      texto: "O Sicredi liberou o arquivo.",
      quando: "há 20 minutos",
      tom: "atencao",
      href: "/conciliacoes/nova",
    },
  ],
  avisosLidos: () => avisosLidos(),
  marcarAvisosLidos: () => marcarAvisosLidos(),
  listarConciliacoes: () => [],
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    replace.mockClear();
    logout.mockClear();
    getSession.mockReset();
    avisosLidos.mockReset();
    marcarAvisosLidos.mockReset();
    avisosLidos.mockReturnValue(false);
  });

  it("redirects to /login when there's no session", () => {
    getSession.mockReturnValue(null);
    render(<AppLayout>conteúdo</AppLayout>);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renders nothing while there is no session yet", () => {
    getSession.mockReturnValue(null);
    const { container } = render(<AppLayout>conteúdo</AppLayout>);
    expect(container.firstChild).toBeNull();
  });

  it("renders children inside the shell when a session exists", async () => {
    getSession.mockReturnValue({ email: "financeiro@telhacerta.com.br" });
    render(<AppLayout>conteúdo autenticado</AppLayout>);

    expect(await screen.findByText("conteúdo autenticado")).toBeInTheDocument();
    // menu lateral e barra superior chegam junto
    expect(screen.getByRole("navigation", { name: "Seções do app" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar lançamento")).toBeInTheDocument();
  });

  it("logs out and returns to /login", async () => {
    getSession.mockReturnValue({ email: "financeiro@telhacerta.com.br" });
    const user = userEvent.setup();
    render(<AppLayout>conteúdo</AppLayout>);

    await user.click(await screen.findByRole("button", { name: "Sair" }));

    expect(logout).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("clears the unread mark once the avisos are read", async () => {
    getSession.mockReturnValue({ email: "financeiro@telhacerta.com.br" });
    const user = userEvent.setup();
    render(<AppLayout>conteúdo</AppLayout>);

    expect(await screen.findByText("3 avisos para você")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Avisos/ }));
    await user.click(screen.getByRole("button", { name: "Marcar como lidos" }));

    expect(marcarAvisosLidos).toHaveBeenCalled();
    expect(screen.getByText("tudo em ordem")).toBeInTheDocument();
  });

  it("starts without the unread mark when the avisos were already read", async () => {
    getSession.mockReturnValue({ email: "financeiro@telhacerta.com.br" });
    avisosLidos.mockReturnValue(true);
    render(<AppLayout>conteúdo</AppLayout>);

    expect(await screen.findByText("tudo em ordem")).toBeInTheDocument();
  });
});

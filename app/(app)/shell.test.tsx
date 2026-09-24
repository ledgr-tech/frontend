import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Shell } from "./shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const sair = vi.fn();
vi.mock("../(auth)/acoes", () => ({
  sair: () => sair(),
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

const EMAIL = "financeiro@telhacerta.com.br";

describe("Shell", () => {
  beforeEach(() => {
    sair.mockClear();
    avisosLidos.mockReset();
    marcarAvisosLidos.mockReset();
    avisosLidos.mockReturnValue(false);
  });

  it("põe o conteúdo dentro do menu lateral e da barra superior", async () => {
    render(<Shell email={EMAIL}>conteúdo autenticado</Shell>);

    expect(await screen.findByText("conteúdo autenticado")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Seções do app" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar lançamento")).toBeInTheDocument();
  });

  it("encerra a sessão pelo servidor", async () => {
    const user = userEvent.setup();
    render(<Shell email={EMAIL}>conteúdo</Shell>);

    // o Sair mora no menu da conta, no rodapé do menu lateral
    await user.click(await screen.findByRole("button", { name: /Financeiro/ }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    // quem apaga o cookie httpOnly e redireciona é a Server Action
    expect(sair).toHaveBeenCalled();
  });

  it("limpa a marca de não lido quando os avisos são lidos", async () => {
    const user = userEvent.setup();
    render(<Shell email={EMAIL}>conteúdo</Shell>);

    await user.click(await screen.findByRole("button", { name: "Avisos 1" }));
    await user.click(screen.getByRole("button", { name: "Marcar como lidos" }));

    expect(marcarAvisosLidos).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
  });

  it("começa sem marca quando os avisos já tinham sido lidos", async () => {
    avisosLidos.mockReturnValue(true);
    render(<Shell email={EMAIL}>conteúdo</Shell>);

    expect(await screen.findByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
    expect(avisosLidos).toHaveBeenCalled();
  });
});

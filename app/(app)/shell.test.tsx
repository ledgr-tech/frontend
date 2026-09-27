import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Cabecalho } from "./cabecalho";
import { Shell } from "./shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const sair = vi.fn();
vi.mock("../(auth)/acoes", () => ({
  sair: () => sair(),
}));

vi.mock("@/lib/mock-data", () => ({
  formatarMoeda: (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
}));

// a barra lê a conciliação mais recente; os avisos têm teste próprio
vi.mock("./conciliacoes/acoes", () => ({
  carregarVisaoGeral: async () => ({
    ok: true,
    dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
  }),
  toleranciaDaUltimaConciliacao: async () => null,
}));

const EMAIL = "financeiro@telhacerta.com.br";

describe("Shell", () => {
  beforeEach(() => {
    sair.mockClear();
  });

  it("põe o conteúdo dentro do menu lateral e da barra superior", async () => {
    render(
      <Shell email={EMAIL} empresa="Telha Certa Ltda">
        conteúdo autenticado
      </Shell>,
    );

    expect(await screen.findByText("conteúdo autenticado")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Seções do app" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar lançamento")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Avisos 0" })).toBeInTheDocument();
  });

  it("encerra a sessão pelo servidor", async () => {
    const user = userEvent.setup();
    render(
      <Shell email={EMAIL} empresa="Telha Certa Ltda">
        conteúdo
      </Shell>,
    );

    // o Sair mora no menu da conta, no rodapé do menu lateral
    await user.click(await screen.findByRole("button", { name: /Financeiro/ }));
    await user.click(screen.getByRole("button", { name: "Sair" }));

    // quem apaga o cookie httpOnly e redireciona é a Server Action
    expect(sair).toHaveBeenCalled();
  });

  it("puts the session's empresa at the start of every screen's header", async () => {
    render(
      <Shell email={EMAIL} empresa="Telha Certa Ltda">
        <Cabecalho titulo="Extratos" contexto={["2 arquivos"]} />
      </Shell>,
    );

    expect(await screen.findByText("Telha Certa Ltda · 2 arquivos")).toBeInTheDocument();
  });
});

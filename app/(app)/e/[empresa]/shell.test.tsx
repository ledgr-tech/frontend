import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowRight } from "lucide-react";
import { Cabecalho } from "./cabecalho";
import { Shell } from "./shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const sair = vi.fn();
vi.mock("../../../(auth)/acoes", () => ({
  sair: () => sair(),
  salvarPreferencias: async () => true,
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
  carregarRegras: async () => ({ ok: false, status: 404, erro: "Not Found" }),
}));

const EMAIL = "financeiro@telhacerta.com.br";

describe("Shell", () => {
  beforeEach(() => {
    sair.mockClear();
  });

  it("põe o conteúdo dentro do menu lateral e da barra superior", async () => {
    render(
      <Shell email={EMAIL} empresa="Telha Certa Ltda" temSenha papel="admin" preferencias={null}>
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
      <Shell email={EMAIL} empresa="Telha Certa Ltda" temSenha papel="admin" preferencias={null}>
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
      <Shell email={EMAIL} empresa="Telha Certa Ltda" temSenha papel="admin" preferencias={null}>
        <Cabecalho titulo="Extratos" contexto={["2 arquivos"]} />
      </Shell>,
    );

    expect(await screen.findByText("Telha Certa Ltda · 2 arquivos")).toBeInTheDocument();
  });

  it("desenha os ícones do menu e das telas com o traço do guia (1,75)", async () => {
    const { container } = render(
      <Shell email={EMAIL} empresa="Telha Certa Ltda" temSenha papel="admin" preferencias={null}>
        <ArrowRight data-testid="icone-da-tela" />
      </Shell>,
    );

    expect(await screen.findByTestId("icone-da-tela")).toHaveAttribute("stroke-width", "1.75");
    const icones = [...container.querySelectorAll("svg.lucide")];
    expect(icones.length).toBeGreaterThan(5);
    for (const icone of icones) expect(icone).toHaveAttribute("stroke-width", "1.75");
  });

  it("o cabeçalho mostra a empresa ativa e o cartão do usuário, o nome da conta", async () => {
    render(
      <Shell email={EMAIL} empresa="Mercado Ltda" nomeDaConta="Escritório Contábil Ltda" temSenha papel="admin" preferencias={null}>
        <Cabecalho titulo="Extratos" contexto={[]} />
      </Shell>,
    );

    const menu = await screen.findByRole("navigation", { name: "Seções do app" });
    expect(screen.getAllByText("Mercado Ltda").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Escritório Contábil Ltda").length).toBeGreaterThan(0);
    // o nome da empresa ativa não está no cartão do usuário, que fica fora do <nav>
    expect(menu).not.toHaveTextContent("Mercado Ltda");
  });

  it("sem nomeDaConta, o cartão do usuário usa o nome da empresa, como antes", async () => {
    render(
      <Shell email={EMAIL} empresa="Telha Certa Ltda" temSenha papel="admin" preferencias={null}>
        conteúdo
      </Shell>,
    );

    expect((await screen.findAllByText("Telha Certa Ltda")).length).toBeGreaterThan(0);
  });
});

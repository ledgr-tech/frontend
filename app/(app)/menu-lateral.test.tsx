import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuLateral } from "./menu-lateral";

const caminho = vi.fn();
const roteador = { push: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => caminho(),
  useRouter: () => roteador,
}));

// a janela de configurações lê a tolerância do backend quando abre, e o
// assistente, a última conciliação
vi.mock("./conciliacoes/acoes", () => ({
  toleranciaDaUltimaConciliacao: async () => 1,
  carregarVisaoGeral: async () => ({
    ok: true,
    dados: { execucoes: [], total: 0, recente: null, arquivosComLinhasNaoLidas: [] },
  }),
  explicarDivergencia: vi.fn(),
}));

const EMAIL = "financeiro@telhacerta.com.br";

function montar(props: Partial<Parameters<typeof MenuLateral>[0]> = {}) {
  return render(<MenuLateral email={EMAIL} empresa="Telha Certa Ltda" onSair={vi.fn()} {...props} />);
}

describe("MenuLateral", () => {
  beforeEach(() => {
    caminho.mockReturnValue("/dashboard");
    window.localStorage.clear();
    delete document.documentElement.dataset.menu;
    delete document.documentElement.dataset.tema;
  });

  it("opens with Visão geral, then the five destinations from the design, in order", () => {
    montar();

    const nav = screen.getByRole("navigation", { name: "Seções do app" });
    expect(nav.textContent).toBe("Visão geralExtratosConciliaçõesFechamentosHistóricoAssinatura");
  });

  it("links every destination, with none left for later", () => {
    montar();

    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("href", "/visao-geral");
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Histórico" })).toHaveAttribute("href", "/historico");
    expect(screen.getByRole("link", { name: "Extratos" })).toHaveAttribute("href", "/extratos");
    expect(screen.getByRole("link", { name: "Fechamentos" })).toHaveAttribute("href", "/fechamentos");
    expect(screen.getByRole("link", { name: "Assinatura" })).toHaveAttribute("href", "/assinatura");
    expect(screen.getByRole("navigation", { name: "Seções do app" })).not.toHaveTextContent("em breve");
  });

  it.each([
    ["Fechamentos", "/fechamentos"],
    ["Assinatura", "/assinatura"],
  ])("marks %s as current on its own route", (nome, rota) => {
    caminho.mockReturnValue(rota);
    montar();
    expect(screen.getByRole("link", { name: nome })).toHaveAttribute("aria-current", "page");
  });

  it("marks Visão geral as current on its own route", () => {
    caminho.mockReturnValue("/visao-geral");
    montar();
    expect(screen.getByRole("link", { name: "Visão geral" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Conciliações" })).not.toHaveAttribute("aria-current");
  });

  it("marks Extratos as current on its own route", () => {
    caminho.mockReturnValue("/extratos");
    montar();
    expect(screen.getByRole("link", { name: "Extratos" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Conciliações as the current page on the dashboard", () => {
    montar();
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Conciliações current on the nested conciliação routes", () => {
    caminho.mockReturnValue("/conciliacoes/conc-1/lc-2");
    montar();
    expect(screen.getByRole("link", { name: "Conciliações" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Histórico" })).not.toHaveAttribute("aria-current");
  });

  it("marks Histórico as current on its own route", () => {
    caminho.mockReturnValue("/historico");
    montar();
    expect(screen.getByRole("link", { name: "Histórico" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Conciliações" })).not.toHaveAttribute("aria-current");
  });

  it("marks nothing as current on a route outside the menu", () => {
    caminho.mockReturnValue("/regras");
    montar();
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("puts Nova conciliação above the destinations", () => {
    montar();

    const nova = screen.getByRole("link", { name: "Nova conciliação" });
    expect(nova).toHaveAttribute("href", "/conciliacoes/nova");
    const nav = screen.getByRole("navigation", { name: "Seções do app" });
    expect(nova.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens with the brand, without the mascot, the aviso line or the way back to the site", () => {
    montar();

    expect(screen.getByText("Ledgr")).toBeInTheDocument();
    expect(screen.queryByText("tudo em ordem")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver o site" })).not.toBeInTheDocument();
  });

  it("collapses and opens from its own buttons", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(document.documentElement.dataset.menu).toBe("recolhido");

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(document.documentElement.dataset.menu).toBe("aberto");
  });

  it("hands the focus to the button that takes the clicked one's place", async () => {
    // o CSS esconde o botão clicado; sem isto o foco cairia no <body>
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByRole("button", { name: "Recolher menu" })).toHaveFocus();
  });

  it("collapses and opens with Ctrl+B", async () => {
    const user = userEvent.setup();
    montar();

    await user.keyboard("{Control>}b{/Control}");
    expect(document.documentElement.dataset.menu).toBe("recolhido");

    await user.keyboard("{Control>}b{/Control}");
    expect(document.documentElement.dataset.menu).toBe("aberto");
  });

  it("offers the theme toggle as an icon, named after where it goes", async () => {
    const user = userEvent.setup();
    montar();

    const botao = await screen.findByRole("button", { name: "Tema escuro" });
    expect(botao.textContent).toBe("");
    await user.click(botao);

    expect(document.documentElement.dataset.tema).toBe("escuro");
    expect(screen.getByRole("button", { name: "Tema claro" })).toBeInTheDocument();
  });

  it("opens the assistant in a panel beside the card, not on a screen of its own", async () => {
    const user = userEvent.setup();
    montar();

    const cartao = screen.getByRole("button", { name: /Fale com o Ledgr/ });
    expect(cartao).toHaveAttribute("aria-expanded", "false");
    await user.click(cartao);

    const painel = screen.getByRole("dialog", { name: "Fale com o Ledgr" });
    expect(cartao).toHaveAttribute("aria-expanded", "true");
    expect(cartao).toHaveAttribute("aria-controls", painel.id);
    expect(await within(painel).findByText(/Ainda não há sobre o que conversar/)).toBeInTheDocument();

    // fechar devolve o foco ao cartão, e o cartão abre e fecha o mesmo painel
    await user.click(within(painel).getByRole("button", { name: "Fechar conversa" }));
    expect(screen.queryByRole("dialog", { name: "Fale com o Ledgr" })).not.toBeInTheDocument();
    expect(cartao).toHaveFocus();
    await user.click(cartao);
    await user.click(cartao);
    expect(screen.queryByRole("dialog", { name: "Fale com o Ledgr" })).not.toBeInTheDocument();
  });

  it("derives the user label and initials from the session email, next to the empresa", () => {
    montar();

    const conta = screen.getByRole("button", { name: /Financeiro/ });
    expect(within(conta).getByText("FI")).toBeInTheDocument();
    expect(within(conta).getByText("Telha Certa Ltda")).toBeInTheDocument();
  });

  it("shows only the user when the backend has not told the empresa yet", () => {
    montar({ empresa: "" });

    const conta = screen.getByRole("button", { name: /Financeiro/ });
    expect(conta).toHaveAttribute("data-dica", "Financeiro");
    expect(conta.querySelector(".app-conta-empresa")).toBeNull();
  });

  it("opens the account menu with the email and the logout", async () => {
    const onSair = vi.fn();
    const user = userEvent.setup();
    montar({ onSair });

    const conta = screen.getByRole("button", { name: /Financeiro/ });
    expect(conta).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();

    await user.click(conta);
    expect(conta).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(EMAIL)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(onSair).toHaveBeenCalled();
  });

  it("closes the account menu on Escape", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Financeiro/ }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("opens the settings window from the account menu, closing the menu", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: /Financeiro/ }));
    await user.click(screen.getByRole("button", { name: /Configurações/ }));

    expect(screen.getByRole("dialog", { name: "Configurações" })).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: /Financeiro/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the settings window with Ctrl+comma, and gives the focus back to the account when it closes", async () => {
    const user = userEvent.setup();
    montar();

    await user.keyboard("{Control>},{/Control}");
    expect(screen.getByRole("dialog", { name: "Configurações" })).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Fechar configurações" }));
    expect(screen.getByRole("button", { name: /Financeiro/ })).toHaveFocus();
  });
});

// O jsdom não tem PointerEvent: sem ele o evento chega sem pointerType, e o menu não sabe se foi
// o mouse ou o dedo.
class PointerEventDeTeste extends MouseEvent {
  readonly pointerType: string;
  constructor(tipo: string, init: PointerEventInit = {}) {
    super(tipo, init);
    this.pointerType = init.pointerType ?? "";
  }
}

// Recolhido, o menu abre por cima do conteúdo com o mouse parado nele, e fecha quando o mouse sai:
// o "peek" do Notion e do Linear. Eventos síncronos com o relógio falso, como no teste da saudação
// do login (o user-event espera um setTimeout que o relógio falso do vitest não solta). O jsdom não
// anima (não tem element.animate), então aqui o estado troca direto; a animação se confere no
// navegador.
describe("MenuLateral recolhido, com o mouse em cima", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("PointerEvent", PointerEventDeTeste);
    caminho.mockReturnValue("/dashboard");
    window.localStorage.clear();
    document.documentElement.dataset.menu = "recolhido";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.menu;
  });

  const menu = () => screen.getByRole("complementary");
  const esperar = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  const mouseEntra = () => fireEvent.pointerEnter(menu(), { pointerType: "mouse" });
  const mouseSai = () => fireEvent.pointerLeave(menu(), { pointerType: "mouse" });

  it("abre por cima depois de um instante com o mouse parado nele, sem deixar de estar recolhido", () => {
    montar();

    mouseEntra();
    expect(menu()).not.toHaveAttribute("data-espiar");

    esperar(150);
    expect(menu()).toHaveAttribute("data-espiar", "aberto");
    expect(document.documentElement.dataset.menu).toBe("recolhido");
  });

  it("não abre quando o mouse só passa por cima", () => {
    montar();

    mouseEntra();
    esperar(100);
    mouseSai();
    esperar(500);

    expect(menu()).not.toHaveAttribute("data-espiar");
  });

  it("fecha um pouco depois que o mouse sai, para quem escorrega para fora e volta", () => {
    montar();
    mouseEntra();
    esperar(150);

    mouseSai();
    esperar(250);
    expect(menu()).toHaveAttribute("data-espiar", "aberto");

    esperar(50);
    expect(menu()).not.toHaveAttribute("data-espiar");
  });

  it("não abre com o menu fixo aberto", () => {
    document.documentElement.dataset.menu = "aberto";
    montar();

    mouseEntra();
    esperar(500);

    expect(menu()).not.toHaveAttribute("data-espiar");
  });

  // no toque não existe "passar por cima": o toque num ícone já é para navegar
  it("não abre com o toque", () => {
    montar();

    fireEvent.pointerEnter(menu(), { pointerType: "touch" });
    esperar(500);

    expect(menu()).not.toHaveAttribute("data-espiar");
  });

  it("aberto por cima, o botão do topo fixa o menu aberto", () => {
    montar();
    mouseEntra();
    esperar(150);

    fireEvent.click(screen.getByRole("button", { name: "Fixar menu" }));

    expect(document.documentElement.dataset.menu).toBe("aberto");
    expect(menu()).not.toHaveAttribute("data-espiar");
  });

  it("não fecha enquanto o menu da conta, aberto dali, continua aberto", () => {
    montar();
    mouseEntra();
    esperar(150);
    fireEvent.click(screen.getByRole("button", { name: /Financeiro/ }));

    mouseSai();
    esperar(1000);
    expect(menu()).toHaveAttribute("data-espiar", "aberto");

    fireEvent.keyDown(window, { key: "Escape" });
    esperar(300);
    expect(menu()).not.toHaveAttribute("data-espiar");
  });

  it("fecha ao ir para outra tela, em vez de ficar por cima dela enquanto carrega", () => {
    montar();
    mouseEntra();
    esperar(150);

    fireEvent.click(screen.getByRole("link", { name: "Histórico" }));
    expect(menu()).not.toHaveAttribute("data-espiar");

    // o mouse continua em cima: só volta a abrir depois de sair e voltar
    esperar(500);
    expect(menu()).not.toHaveAttribute("data-espiar");
    mouseSai();
    mouseEntra();
    esperar(150);
    expect(menu()).toHaveAttribute("data-espiar", "aberto");
  });

  it("continua aberto no Ctrl+clique, que abre a tela em outra aba", () => {
    montar();
    mouseEntra();
    esperar(150);

    fireEvent.click(screen.getByRole("link", { name: "Histórico" }), { ctrlKey: true });

    expect(menu()).toHaveAttribute("data-espiar", "aberto");
  });

  it("o Ctrl+B fecha o que estava aberto por cima e fixa o menu aberto", () => {
    montar();
    mouseEntra();
    esperar(150);

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });

    expect(document.documentElement.dataset.menu).toBe("aberto");
    expect(menu()).not.toHaveAttribute("data-espiar");
  });
});

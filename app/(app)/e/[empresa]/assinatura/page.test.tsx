import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLANOS } from "@/lib/planos";
import { adaptarPrecos, type Assinatura, type PrecoDoPlano } from "@/lib/assinatura";
import type { LimitesDaConta } from "@/lib/limites";
import type { Papel } from "@/lib/papel";
import { ProvedorDaConta } from "../conta";
import AssinaturaPage from "./page";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/e/x/assinatura",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const precos = vi.hoisted(() => ({ atuais: null as PrecoDoPlano[] | null }));
const iniciarCheckout = vi.fn();
vi.mock("./acoes", () => ({
  carregarPrecos: async () => precos.atuais,
  iniciarCheckout: (...args: unknown[]) => iniciarCheckout(...args),
}));

// a tela só existe com a cobrança ligada (`cobranca_habilitada` do /me); os testes de baixo a ligam
const cobranca = vi.hoisted(() => ({ ligada: true }));
vi.mock("../../../../(auth)/acoes", () => ({ contaDaSessao: async () => ({ cobrancaHabilitada: cobranca.ligada }) }));
const redirecionarNoApp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rotas-servidor", () => ({ redirecionarNoApp: (caminho: string) => redirecionarNoApp(caminho) }));

describe("com a cobrança desligada (backend #202)", () => {
  afterEach(() => {
    cobranca.ligada = true;
  });

  it("vai para a Visão geral sem pedir os preços, que responderiam 503", async () => {
    cobranca.ligada = false;
    const carregar = vi.spyOn(await import("./acoes"), "carregarPrecos");

    await AssinaturaPage();

    expect(redirecionarNoApp).toHaveBeenCalledWith("/visao-geral");
    expect(carregar).not.toHaveBeenCalled();
  });
});

// o catálogo provisório do backend #180, em centavos
const CATALOGO = adaptarPrecos(
  Object.entries({
    essencial: { mensal: 14900, trimestral: 42500, semestral: 80500, anual: 152000 },
    padrao: { mensal: 29900, trimestral: 85500, semestral: 161500, anual: 305000 },
    avancado: { mensal: 59900, trimestral: 171000, semestral: 323000, anual: 610000 },
  }).flatMap(([plano, valores]) => Object.entries(valores).map(([periodo, valor_centavos]) => ({ plano, periodo, valor_centavos }))),
)!;

async function montar(
  assinatura?: Assinatura,
  { papel = "admin", limites = null }: { papel?: Papel; limites?: LimitesDaConta | null } = {},
) {
  const pagina = await AssinaturaPage();
  if (!assinatura) return render(pagina);
  return render(
    <ProvedorDaConta cobrancaHabilitada preferencias={null} assinatura={assinatura} papel={papel} limites={limites}>
      {pagina}
    </ProvedorDaConta>,
  );
}

const conta = (extra: Partial<Assinatura>): Assinatura => ({
  situacao: "teste",
  plano: null,
  testeTerminaEm: null,
  fimDoTeste: null,
  cobranca: null,
  ...extra,
});

const emDias = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString();

const assign = vi.fn();
const replaceState = vi.fn();
const localOriginal = window.location;

/** A URL da tela, com a busca da volta da Stripe; `assign` é a ida para a Stripe. */
function naUrl(busca = "") {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...localOriginal, pathname: "/e/x/assinatura", search: busca, assign },
  });
}

beforeEach(() => {
  precos.atuais = CATALOGO;
  iniciarCheckout.mockReset();
  assign.mockReset();
  replaceState.mockReset();
  Object.values(router).forEach((fn) => fn.mockReset());
  vi.spyOn(window.history, "replaceState").mockImplementation(replaceState);
  naUrl();
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: localOriginal });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const AVISO =
  "A cobrança ainda não está no ar. Plano e faturas desta tela são de demonstração, e nada é alterado por aqui.";

function linhasDasFaturas() {
  const tabela = screen.getByRole("table");
  // a primeira linha é o cabeçalho
  return within(tabela).getAllByRole("row").slice(1);
}

describe("AssinaturaPage", () => {
  it("shows the current plan and the renewal date under the title", async () => {
    await montar();
    expect(screen.getByRole("heading", { level: 1, name: "Assinatura" })).toBeInTheDocument();
    expect(screen.getByText("plano Escala · renova em 12 de outubro")).toBeInTheDocument();
  });

  it("summarises the plan, the accounts and September's volume", async () => {
    await montar();
    // "Plano atual" também é o botão do cartão do plano; aqui é o rótulo do resumo
    expect(screen.getByText("Plano atual", { selector: ".dash-rotulo" })).toBeInTheDocument();
    expect(screen.getByText("Renova em 12 de outubro", { selector: ".dash-nota" })).toBeInTheDocument();
    expect(screen.getByText("Contas conciliadas")).toBeInTheDocument();
    expect(screen.getByText("Sicredi, Sicoob, Itaú e Banco do Brasil")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos em setembro")).toBeInTheDocument();
    expect(screen.getByText("4.218")).toBeInTheDocument();
    expect(screen.getByText("Conferidos contra o razão do Cigam")).toBeInTheDocument();
  });

  it("lists the plans without prices (only Volume is sob consulta), marking the current one", async () => {
    await montar();
    const lista = screen.getByRole("list", { name: "Planos" });
    const planos = within(lista).getAllByRole("listitem");

    expect(planos).toHaveLength(PLANOS.length);
    PLANOS.forEach((plano, i) => {
      expect(within(planos[i]).getByRole("heading", { name: plano.nome })).toBeInTheDocument();
      // sem preço da Stripe, nenhum valor, nem de demonstração (#296)
      expect(planos[i].textContent).not.toMatch(/R\$/);
      // nenhum limite de lançamentos: a franquia é de conciliações (#297)
      expect(planos[i].textContent).not.toMatch(/lançamentos por mês/);
    });

    const atual = planos.find((item) => within(item).queryByText("Atual"));
    expect(atual).toBeDefined();
    expect(within(atual!).getByRole("heading", { name: "Escala" })).toBeInTheDocument();
    expect(
      within(atual!).getByText("Quatro bancos conciliados em setembro."),
    ).toBeInTheDocument();
    expect(within(atual!).getByRole("button", { name: "Plano atual" })).toBeDisabled();
  });

  it("lists the invoices newest first, with the landing's prices", async () => {
    await montar();
    const linhas = linhasDasFaturas();

    expect(linhas.map((linha) => within(linha).getAllByRole("cell")[0].textContent)).toEqual([
      "Outubro de 2026",
      "Setembro de 2026",
      "Agosto de 2026",
      "Julho de 2026",
    ]);
    expect(within(linhas[1]).getByText("12 de setembro")).toBeInTheDocument();
    // sem valor: os preços ainda não foram definidos (#296)
    expect(screen.queryByRole("columnheader", { name: "Valor" })).not.toBeInTheDocument();
    for (const linha of linhas) expect(linha.textContent).not.toMatch(/R\$/);
  });

  it("colours paid invoices as settled and leaves the upcoming one neutral", async () => {
    await montar();
    const [outubro, setembro] = linhasDasFaturas();

    expect(within(setembro).getByText("Paga")).toHaveClass("selo", "selo-ok");
    const aVencer = within(outubro).getByText("A vencer");
    expect(aVencer).toHaveClass("selo");
    expect(aVencer).not.toHaveClass("selo-ok");
  });

  it("offers a receipt only for paid invoices", async () => {
    await montar();
    const [outubro, setembro] = linhasDasFaturas();

    expect(within(setembro).getByRole("button", { name: "Recibo de setembro de 2026 em PDF" })).toBeInTheDocument();
    expect(within(outubro).queryByRole("button")).not.toBeInTheDocument();
    expect(within(outubro).getByText("—")).toBeInTheDocument();
  });

  it("says billing is not live and keeps every billing change disabled, pointing to why", async () => {
    await montar();
    expect(screen.getByRole("note")).toHaveTextContent(AVISO);

    const trocarPagamento = screen.getByRole("button", { name: "Trocar forma de pagamento" });
    expect(trocarPagamento).toBeDisabled();
    expect(trocarPagamento).toHaveAccessibleDescription(AVISO);

    const mudar = screen.getByRole("button", { name: "Mudar para Essencial" });
    expect(mudar).toBeDisabled();
    expect(mudar).toHaveAccessibleDescription(AVISO);

    const recibo = screen.getByRole("button", { name: "Recibo de setembro de 2026 em PDF" });
    expect(recibo).toBeDisabled();
    expect(recibo).toHaveAccessibleDescription(AVISO);
  });

  it("opens the cancel confirmation in the app's modal, with focus on keeping the subscription", async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    // a mesma janela das outras telas: o <dialog> nativo, não uma caixa montada à mão
    const dialogo = screen.getByRole("dialog", { name: "Cancelar a assinatura desta empresa?" });
    expect(dialogo.tagName).toBe("DIALOG");
    expect(within(dialogo).getByRole("button", { name: "Manter assinatura" })).toHaveFocus();
  });

  it("says the access goes on until the end of the paid period (#232)", async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    expect(
      within(screen.getByRole("dialog")).getByText(
        "Você continua com acesso a tudo até 12 de outubro, o fim do período já pago. Depois disso, o histórico continua disponível para consulta, mas nenhum extrato novo poderá ser conciliado.",
      ),
    ).toBeInTheDocument();
  });

  it("never confirms the cancellation, and says why next to the button", async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    const dialogo = screen.getByRole("dialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Cancelar mesmo assim" });
    expect(confirmar).toBeDisabled();
    expect(confirmar).toHaveAccessibleDescription("A cobrança ainda não está no ar: nada é cancelado por aqui.");
  });

  it("closes on Escape and hands focus back to the button that opened it", async () => {
    const user = userEvent.setup();
    await montar();
    const abrir = screen.getByRole("button", { name: "Cancelar assinatura" });

    await user.click(abrir);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("closes on Manter assinatura", async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await user.click(screen.getByRole("button", { name: "Manter assinatura" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar assinatura" })).toHaveFocus();
  });

  it("closes when the backdrop is clicked, but not when the box inside is", async () => {
    const user = userEvent.setup();
    await montar();

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await user.click(screen.getByText(/fim do período já pago/));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // o fundo escurecido é o próprio <dialog>
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("pela situação da conta (backend #180)", () => {
    const planos = () => within(screen.getByRole("list", { name: "Planos" })).getAllByRole("listitem");
    const cartao = (nome: string) => planos().find((item) => item.textContent?.includes(nome))!;
    const painel = () => screen.getByRole("region", { name: "Plano escolhido" });
    const abrir = (user: ReturnType<typeof userEvent.setup>, nome: string) => user.click(within(cartao(nome)).getByRole("button"));

    it("no teste: as três folhas, os dias no cabeçalho, o Assinar no painel e o Volume para falar com a gente", async () => {
      await montar(conta({ situacao: "teste", testeTerminaEm: emDias(9.5).slice(0, 10), fimDoTeste: emDias(9.5) }));
      expect(screen.getByText(/^teste grátis · faltam \d+ dias$/)).toBeInTheDocument();
      expect(planos()).toHaveLength(3);
      expect(within(cartao("Padrão")).getByText("R$ 299,00")).toBeInTheDocument();
      // o Padrão, o mais comum, já vem aberto
      expect(within(cartao("Padrão")).getByRole("button")).toHaveAttribute("aria-pressed", "true");
      expect(within(painel()).getByRole("button", { name: "Assinar o Padrão" })).toBeEnabled();
      const volume = screen.getByRole("region", { name: "Concilia em grande volume?" });
      expect(volume).toHaveTextContent("Plano Volume · sob consulta");
      expect(within(volume).getByRole("link", { name: "Fale com a gente" })).toHaveAttribute("href", "mailto:ledgrtech@gmail.com");
      // nada da demonstração
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
    });

    it("no teste, a folha aberta leva o selo com o dia do fim, e ele segue o clique", async () => {
      const user = userEvent.setup();
      const fim = emDias(9.5);
      await montar(conta({ situacao: "teste", testeTerminaEm: fim.slice(0, 10), fimDoTeste: fim }));
      const [, mes, dia] = fim.slice(0, 10).split("-");
      expect(within(cartao("Padrão")).getByText(`Grátis até ${dia}/${mes}`)).toBeInTheDocument();
      await abrir(user, "Essencial");
      expect(within(cartao("Essencial")).getByText(`Grátis até ${dia}/${mes}`)).toBeInTheDocument();
      expect(within(cartao("Padrão")).queryByText(/^Grátis até/)).not.toBeInTheDocument();
      expect(within(painel()).getByRole("heading", { name: "Essencial" })).toBeInTheDocument();
    });

    it("com menos de 48 horas de teste a cobrança é na hora, então nenhum selo promete grátis", async () => {
      await montar(conta({ situacao: "teste", testeTerminaEm: emDias(1).slice(0, 10), fimDoTeste: emDias(1) }));
      expect(screen.queryByText(/^Grátis até/)).not.toBeInTheDocument();
      expect(within(painel()).getByText("É feita agora.")).toBeInTheDocument();
    });

    it("o link da tela de bloqueio já abre o plano escolhido lá", async () => {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { ...localOriginal, pathname: "/e/x/assinatura", search: "", hash: "#plano-avancado", assign },
      });
      await montar(conta({ situacao: "teste_encerrado" }));
      expect(within(painel()).getByRole("heading", { name: "Avançado" })).toBeInTheDocument();
    });

    describe("assinando: o painel segue a folha aberta", () => {
      const cobranca = { status: "active", plano: "padrao" as const, periodo: "mensal" as const, periodoAtualFim: "2026-12-14", cancelaNoFim: false };
      const assinante = conta({ situacao: "ativo", plano: "padrao", cobranca });

      it("o seu plano abre com o pagamento, o uso e os caminhos pela equipe", async () => {
        await montar(assinante, { limites: { empresas: { usadas: 2, maximo: 5 }, usuarios: { usadas: 2, maximo: 3 }, conciliacoes: { usadas: 8, maximo: null } } });
        expect(within(painel()).getByRole("heading", { name: "Padrão" })).toBeInTheDocument();
        expect(painel()).toHaveTextContent("R$ 299,00 por mês, no cartão");
        expect(painel()).toHaveTextContent(/Em dia\. Renova em 14\/12/);
        expect(painel()).toHaveTextContent("2 de 5");
        expect(within(cartao("Padrão")).getByText("Seu plano")).toBeInTheDocument();
        expect(cartao("Padrão")).toHaveTextContent("8 conciliações este mês");
        expect(within(painel()).getByRole("link", { name: "Trocar o cartão" }).getAttribute("href")).toMatch(/^mailto:ledgrtech@gmail\.com/);
        expect(within(painel()).getByRole("link", { name: "Cancelar a assinatura" })).toBeInTheDocument();
      });

      it("com o cancelamento agendado, diz quando termina e não oferece cancelar de novo", async () => {
        await montar(conta({ situacao: "ativo", plano: "padrao", cobranca: { ...cobranca, cancelaNoFim: true } }));
        expect(painel()).toHaveTextContent(/Termina em 14\/12/);
        expect(within(painel()).queryByRole("link", { name: "Cancelar a assinatura" })).not.toBeInTheDocument();
      });

      it("outra folha compara com o seu plano, com a diferença de um mês, e volta", async () => {
        const user = userEvent.setup();
        await montar(assinante);
        await abrir(user, "Essencial");
        expect(within(painel()).getByRole("heading", { name: "Essencial" })).toBeInTheDocument();
        expect(painel()).toHaveTextContent("R$ 150,00 a menos por mês que o Padrão");
        expect(within(painel()).getByRole("link", { name: "Fale com a gente para trocar" })).toBeInTheDocument();

        await abrir(user, "Avançado");
        expect(painel()).toHaveTextContent("R$ 300,00 a mais por mês que o Padrão");

        await user.click(screen.getByRole("button", { name: "Anual" }));
        // (6.100 - 3.050) / 12
        expect(painel()).toHaveTextContent("R$ 254,17 a mais por mês que o Padrão, os dois no anual");

        await user.click(within(painel()).getByRole("button", { name: "Voltar à sua assinatura" }));
        expect(within(painel()).getByRole("heading", { name: "Padrão" })).toBeInTheDocument();
        expect(within(painel()).queryByText(/Diferença/)).not.toBeInTheDocument();
      });

      it("avisa quando o uso do mês passa da franquia do plano aberto", async () => {
        const user = userEvent.setup();
        precos.atuais = adaptarPrecos([
          { plano: "essencial", periodo: "mensal", valor_centavos: 14900, limites: { conciliacoes_por_mes: 2 } },
          { plano: "padrao", periodo: "mensal", valor_centavos: 29900, limites: { conciliacoes_por_mes: 80 } },
        ]);
        await montar(assinante, { limites: { empresas: null, usuarios: null, conciliacoes: { usadas: 8, maximo: 80 } } });
        await abrir(user, "Essencial");
        expect(within(painel()).getByRole("note")).toHaveTextContent("Neste mês você fez 8 conciliações, e este plano inclui até 2.");
      });
    });

    it.each([
      ["teste_encerrado", "teste grátis encerrado"],
      ["assinatura_encerrada", "assinatura encerrada"],
      ["pagamento_pendente", "pagamento pendente"],
    ] as const)("%s diz a situação no cabeçalho", async (situacao, contexto) => {
      await montar(conta({ situacao }));
      expect(screen.getByText(contexto)).toBeInTheDocument();
    });

    it("com o teste ou a assinatura encerrados, lembra que o que foi feito continua", async () => {
      await montar(conta({ situacao: "assinatura_encerrada" }));
      expect(screen.getByText(/O que você já fez continua aqui/)).toBeInTheDocument();
    });

    it("com o pagamento pendente, avisa que a Stripe tenta de novo", async () => {
      const cobranca = { status: "past_due", plano: "padrao" as const, periodo: "mensal" as const, periodoAtualFim: "2026-12-14", cancelaNoFim: false };
      await montar(conta({ situacao: "pagamento_pendente", plano: "padrao", cobranca }));
      expect(screen.getByRole("alert")).toHaveTextContent("Não passou. A Stripe vai tentar de novo nos próximos dias.");
      expect(within(cartao("Padrão")).getByText("Pagamento pendente")).toBeInTheDocument();
      expect(within(painel()).getByRole("link", { name: "Trocar o cartão" })).toHaveClass("btn-primary");
    });

    it("assinando: o plano, o período e a renovação no cabeçalho, e só o plano atual marcado", async () => {
      // a renovação de outro ano leva o ano
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-03T12:00:00-03:00"));
      const cobranca = { status: "active", plano: "padrao" as const, periodo: "anual" as const, periodoAtualFim: "2027-10-31", cancelaNoFim: false };
      const { unmount } = await montar(conta({ situacao: "ativo", plano: "padrao", cobranca }));
      expect(screen.getByText("plano Padrão · anual · renova em 31/10/2027")).toBeInTheDocument();
      expect(within(cartao("Padrão")).getByText("Plano atual")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Assinar/ })).not.toBeInTheDocument();
      unmount();

      await montar(conta({ situacao: "ativo", plano: "padrao", cobranca: { ...cobranca, cancelaNoFim: true } }));
      expect(screen.getByText("plano Padrão · anual · termina em 31/10/2027")).toBeInTheDocument();
    });

    it("assinando no anual, o seletor e os preços começam no anual, também depois da volta da Stripe", async () => {
      const cobranca = { status: "active", plano: "padrao" as const, periodo: "anual" as const, periodoAtualFim: "2027-10-31", cancelaNoFim: false };
      const pagina = await AssinaturaPage();
      const arvore = (assinatura: Assinatura) => (
        <ProvedorDaConta cobrancaHabilitada preferencias={null} assinatura={assinatura} papel="admin">
          {pagina}
        </ProvedorDaConta>
      );
      const { rerender } = render(arvore(conta({ situacao: "teste" })));
      rerender(arvore(conta({ situacao: "ativo", plano: "padrao", cobranca })));
      expect(screen.getByRole("button", { name: "Anual" })).toHaveAttribute("aria-pressed", "true");
      expect(within(cartao("Padrão")).getByText("R$ 3.050,00")).toBeInTheDocument();
    });

    it("o período troca os preços, o valor por mês e o desconto dos três cartões", async () => {
      const user = userEvent.setup();
      await montar(conta({ situacao: "teste" }));
      expect(screen.getByRole("button", { name: "Mensal" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("button", { name: "Trimestral" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Anual" }));
      expect(within(cartao("Essencial")).getByText("R$ 1.520,00")).toBeInTheDocument();
      expect(within(cartao("Essencial")).getByText("R$ 126,67 por mês")).toBeInTheDocument();
      expect(within(cartao("Essencial")).getByText("15% a menos")).toBeInTheDocument();
      await abrir(user, "Essencial");
      expect(within(painel()).getByText("15% a menos que o mensal")).toBeInTheDocument();
      expect(within(cartao("Avançado")).getByText("R$ 6.100,00")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Ver outros períodos" }));
      await user.click(screen.getByRole("button", { name: "Semestral" }));
      expect(within(cartao("Padrão")).getByText("R$ 1.615,00")).toBeInTheDocument();
    });

    it("sem os preços da Stripe, nenhum valor, sem período, e o Assinar desligado", async () => {
      precos.atuais = null;
      await montar(conta({ situacao: "teste" }));
      expect(screen.queryByRole("button", { name: "Anual" })).not.toBeInTheDocument();
      const assinar = within(painel()).getByRole("button", { name: "Assinar o Padrão" });
      expect(assinar).toBeDisabled();
      expect(assinar).toHaveAccessibleDescription("A assinatura pelo cartão ainda não está no ar.");
      expect(painel().textContent).not.toMatch(/R\$/);
      // os de lib/planos não valem mais (#296): sem a Stripe, nenhum R$ nos planos do teste
      for (const nome of ["Essencial", "Padrão", "Avançado"]) expect(cartao(nome).textContent).not.toMatch(/R\$/);
      // com o cartão fora do ar, assinar segue sendo pela equipe, como na /plano de antes
      expect(screen.getByRole("link", { name: "Fale com a gente para assinar" })).toHaveAttribute(
        "href",
        "mailto:ledgrtech@gmail.com?subject=Assinar%20um%20plano",
      );
    });

    it("um período que falta para um plano só desliga o Assinar desse plano", async () => {
      precos.atuais = CATALOGO.filter((p) => !(p.plano === "avancado" && p.periodo === "anual"));
      const user = userEvent.setup();
      await montar(conta({ situacao: "teste" }));
      await user.click(screen.getByRole("button", { name: "Anual" }));
      expect(within(cartao("Avançado")).getByText("Indisponível neste período")).toBeInTheDocument();
      expect(within(painel()).getByRole("button", { name: "Assinar o Padrão" })).toBeEnabled();
      await abrir(user, "Avançado");
      const assinar = within(painel()).getByRole("button", { name: "Assinar o Avançado" });
      expect(assinar).toBeDisabled();
      expect(assinar).toHaveAccessibleDescription("Indisponível neste período");
    });

    it("gestor e analista veem os planos, mas só o administrador assina", async () => {
      await montar(conta({ situacao: "teste" }), { papel: "gestor" });
      const assinar = within(painel()).getByRole("button", { name: "Assinar o Padrão" });
      expect(assinar).toBeDisabled();
      expect(assinar).toHaveAccessibleDescription("Só o administrador da conta assina.");
    });

    it("mostra a franquia de conciliações do mês", async () => {
      await montar(conta({ situacao: "teste" }), { limites: { empresas: null, usuarios: null, conciliacoes: { usadas: 3, maximo: 20 } } });
      expect(screen.getByText("3 de 20 conciliações este mês")).toBeInTheDocument();
    });

    it("a folha de cada plano traz a franquia do backend, igual em todo período; sem número, nenhuma linha (#297)", async () => {
      precos.atuais = adaptarPrecos([
        { plano: "essencial", periodo: "mensal", valor_centavos: 14900, limites: { conciliacoes_por_mes: 30 } },
        { plano: "essencial", periodo: "anual", valor_centavos: 152000, limites: { conciliacoes_por_mes: 30 } },
        { plano: "padrao", periodo: "mensal", valor_centavos: 29900, limites: { conciliacoes_por_mes: null } },
      ]);
      await montar(conta({ situacao: "teste" }));
      expect(cartao("Essencial")).toHaveTextContent("até 30 conciliações por mês");
      expect(cartao("Padrão").textContent).not.toMatch(/conciliações|ilimitad/i);
    });

    it("ativo sem a cobrança da Stripe (o piloto ativado à mão) segue a tela de demonstração", async () => {
      await montar(conta({ situacao: "ativo", plano: "padrao" }));
      expect(screen.getByText("Plano atual", { selector: ".dash-rotulo" })).toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
  describe("assinar (backend #180)", () => {
    const planos = () => within(screen.getByRole("list", { name: "Planos" })).getAllByRole("listitem");
    const cartao = (nome: string) => planos().find((item) => item.textContent?.includes(nome))!;
    const painel = () => screen.getByRole("region", { name: "Plano escolhido" });
    const abrir = (user: ReturnType<typeof userEvent.setup>, nome: string) => user.click(within(cartao(nome)).getByRole("button"));
    const fimEm = (horas: number) => {
      const fim = new Date(Date.now() + horas * 3_600_000);
      return { testeTerminaEm: fim.toISOString().slice(0, 10), fimDoTeste: fim.toISOString() };
    };

    it("com mais de 48 horas de teste, diz quando paga e vai para a Stripe", async () => {
      const user = userEvent.setup();
      let abrir!: (valor: unknown) => void;
      iniciarCheckout.mockReturnValue(new Promise((r) => (abrir = r)));
      const fim = fimEm(9 * 24);
      await montar(conta({ situacao: "teste", ...fim }));
      const [, mes, dia] = fim.testeTerminaEm.split("-");
      expect(painel()).toHaveTextContent(`Em ${dia}/${mes}, quando o teste acaba.`);

      await user.click(within(painel()).getByRole("button", { name: "Assinar o Padrão" }));
      expect(iniciarCheckout).toHaveBeenCalledWith("padrao", "mensal");
      expect(within(painel()).getByRole("button", { name: "Abrindo a Stripe…" })).toBeDisabled();
      await act(async () => abrir({ ok: true, dados: { url: "https://checkout.stripe.com/c/pay/cs_test_1" } }));
      expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_1");
    });

    it("leva o período escolhido", async () => {
      const user = userEvent.setup();
      iniciarCheckout.mockResolvedValue({ ok: true, dados: { url: "https://checkout.stripe.com/x" } });
      await montar(conta({ situacao: "teste", ...fimEm(9 * 24) }));
      await user.click(screen.getByRole("button", { name: "Anual" }));
      await abrir(user, "Essencial");
      await user.click(within(painel()).getByRole("button", { name: "Assinar o Essencial" }));
      expect(iniciarCheckout).toHaveBeenCalledWith("essencial", "anual");
    });

    const SEM_TESTE = "A cobrança é feita agora.";
    it.each([
      ["com menos de 48 horas de teste", () => conta({ situacao: "teste", ...fimEm(47) }), `${SEM_TESTE} Os dias de teste que sobraram não ficam para depois.`],
      // sem teste em andamento, não há dias que sobraram
      ["com o teste encerrado", () => conta({ situacao: "teste_encerrado" }), SEM_TESTE],
      ["com a assinatura encerrada", () => conta({ situacao: "assinatura_encerrada" }), SEM_TESTE],
    ])("%s, avisa que cobra agora antes de chamar", async (_, montarConta, aviso) => {
      const user = userEvent.setup();
      iniciarCheckout.mockResolvedValue({ ok: true, dados: { url: "https://checkout.stripe.com/x" } });
      await montar(montarConta());
      await user.click(within(painel()).getByRole("button", { name: "Assinar o Padrão" }));
      expect(iniciarCheckout).not.toHaveBeenCalled();
      expect(within(painel()).getByText(aviso)).toBeInTheDocument();
      await user.click(within(painel()).getByRole("button", { name: "Assinar e pagar agora" }));
      expect(iniciarCheckout).toHaveBeenCalledWith("padrao", "mensal");
    });

    it("dois cliques rápidos chamam uma vez", async () => {
      iniciarCheckout.mockReturnValue(new Promise(() => {}));
      await montar(conta({ situacao: "teste", ...fimEm(9 * 24) }));
      const botao = within(painel()).getByRole("button", { name: "Assinar o Padrão" });
      act(() => {
        botao.click();
        botao.click();
      });
      expect(iniciarCheckout).toHaveBeenCalledTimes(1);
    });

    it("a recusa aparece no cartão; o 409 relê a conta", async () => {
      const user = userEvent.setup();
      iniciarCheckout.mockResolvedValue({ ok: false, status: 409, erro: "A conta já tem uma assinatura." });
      await montar(conta({ situacao: "teste", ...fimEm(9 * 24) }));
      await user.click(within(painel()).getByRole("button", { name: "Assinar o Padrão" }));
      expect(within(painel()).getByRole("alert")).toHaveTextContent("A conta já tem uma assinatura.");
      expect(router.refresh).toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
      expect(within(painel()).getByRole("button", { name: "Assinar o Padrão" })).toBeEnabled();
    });

    it("um 503 mostra o texto da ação, sem reler", async () => {
      const user = userEvent.setup();
      iniciarCheckout.mockResolvedValue({ ok: false, status: 503, erro: "A assinatura não está disponível agora. Tente de novo mais tarde." });
      await montar(conta({ situacao: "teste", ...fimEm(9 * 24) }));
      await user.click(within(painel()).getByRole("button", { name: "Assinar o Padrão" }));
      expect(within(painel()).getByRole("alert")).toHaveTextContent("A assinatura não está disponível agora.");
      expect(router.refresh).not.toHaveBeenCalled();
    });
  });

  describe("a volta da Stripe", () => {
    const ATIVO = conta({
      situacao: "ativo",
      plano: "padrao",
      cobranca: { status: "active", plano: "padrao", periodo: "mensal", periodoAtualFim: "2026-11-30", cancelaNoFim: false },
    });

    async function voltar(busca: string, inicial: Assinatura) {
      naUrl(busca);
      const pagina = await AssinaturaPage();
      const arvore = (assinatura: Assinatura) => (
        <ProvedorDaConta cobrancaHabilitada preferencias={null} assinatura={assinatura} papel="admin">
          {pagina}
        </ProvedorDaConta>
      );
      const tela = render(arvore(inicial));
      return { trocar: (assinatura: Assinatura) => tela.rerender(arvore(assinatura)) };
    }

    it("confirmando: relê a cada 3 s até o webhook virar a conta", async () => {
      vi.useFakeTimers();
      const { trocar } = await voltar("?checkout=sucesso", conta({ situacao: "teste" }));
      expect(screen.getByRole("status")).toHaveTextContent("Confirmando seu pagamento…");
      act(() => vi.advanceTimersByTime(3000));
      expect(replaceState).toHaveBeenCalledWith(window.history.state, "", "/e/x/assinatura");
      expect(router.refresh).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(3000));
      expect(router.refresh).toHaveBeenCalledTimes(2);

      act(() => trocar(ATIVO));
      expect(screen.getByRole("status")).toHaveTextContent("Assinatura confirmada: plano Padrão, mensal.");
      act(() => vi.advanceTimersByTime(9000));
      expect(router.refresh).toHaveBeenCalledTimes(2);
    });

    it("sem confirmação em 30 s, diz que pode demorar e segue relendo mais devagar", async () => {
      vi.useFakeTimers();
      await voltar("?checkout=sucesso", conta({ situacao: "teste" }));
      act(() => vi.advanceTimersByTime(30_000));
      expect(screen.getByRole("status")).toHaveTextContent(
        "A Stripe ainda não confirmou o pagamento. Isso pode levar alguns minutos; esta tela mostra quando confirmar.",
      );
      const vezes = router.refresh.mock.calls.length;
      act(() => vi.advanceTimersByTime(9000));
      expect(router.refresh).toHaveBeenCalledTimes(vezes);
      act(() => vi.advanceTimersByTime(6000));
      expect(router.refresh).toHaveBeenCalledTimes(vezes + 1);
    });

    it("com o pagamento pendente e a cobrança criada, também confirma", async () => {
      vi.useFakeTimers();
      await voltar("?checkout=sucesso", { ...ATIVO, situacao: "pagamento_pendente" });
      expect(screen.getByRole("status")).toHaveTextContent("Assinatura confirmada: plano Padrão, mensal.");
    });

    it("com a conta já assinando, confirma na hora", async () => {
      vi.useFakeTimers();
      await voltar("?checkout=sucesso", ATIVO);
      expect(screen.getByRole("status")).toHaveTextContent("Assinatura confirmada: plano Padrão, mensal.");
      act(() => vi.advanceTimersByTime(6000));
      expect(router.refresh).not.toHaveBeenCalled();
    });

    describe("a comemoração (#300)", () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-03T12:00:00-03:00"));
      });
      const janela = () => screen.getByRole("dialog", { name: "Assinatura confirmada" });

      it("assinando no teste: o plano, a primeira cobrança no fim dele e o que o plano libera", async () => {
        await voltar("?checkout=sucesso", conta({ ...ATIVO, cobranca: { ...ATIVO.cobranca!, status: "trialing", periodoAtualFim: "2026-11-17" } }));
        expect(within(janela()).getByRole("heading", { name: "O plano Padrão é seu." })).toBeInTheDocument();
        expect(within(janela()).getByText("Você só paga em 17/11, quando o teste acaba. Até lá, nada muda: siga conciliando como antes.")).toBeInTheDocument();
        expect(within(janela()).getByText("Primeira cobrança")).toBeInTheDocument();
        expect(within(janela()).getByText("Mensal")).toBeInTheDocument();
        expect(within(janela()).getByText("Empresas clientes, cada uma com os seus extratos")).toBeInTheDocument();
        expect(within(janela()).getByRole("link", { name: "Começar uma conciliação" })).toHaveAttribute("href", "/conciliacoes/nova");
      });

      it("fora do teste: a cobrança já foi feita, e a próxima leva o ano quando é no ano seguinte", async () => {
        await voltar("?checkout=sucesso", conta({ ...ATIVO, cobranca: { ...ATIVO.cobranca!, periodo: "anual", periodoAtualFim: "2027-11-03" } }));
        expect(within(janela()).getByText("A primeira cobrança foi feita agora. O que você já fez continua aqui.")).toBeInTheDocument();
        expect(within(janela()).getByText("Próxima cobrança")).toBeInTheDocument();
        expect(within(janela()).getByText("03/11/2027")).toBeInTheDocument();
        expect(within(janela()).getByText("Anual")).toBeInTheDocument();
      });

      it("fecha e fica a linha de sempre; recarregar não repete, porque o sucesso sai da URL", async () => {
        const user = userEvent.setup();
        await voltar("?checkout=sucesso", ATIVO);
        await user.click(within(janela()).getByRole("button", { name: "Ver a assinatura" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Assinatura confirmada: plano Padrão, mensal.");
        await waitFor(() => expect(replaceState).toHaveBeenCalledWith(window.history.state, "", "/e/x/assinatura"));
      });

      it("o X fecha também", async () => {
        const user = userEvent.setup();
        await voltar("?checkout=sucesso", ATIVO);
        await user.click(within(janela()).getByRole("button", { name: "Fechar" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      it("com o pagamento pendente, não comemora", async () => {
        await voltar("?checkout=sucesso", { ...ATIVO, situacao: "pagamento_pendente" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      it("sem a volta da Stripe, não abre", async () => {
        await voltar("", ATIVO);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("cancelado: diz que nada foi cobrado", async () => {
      await voltar("?checkout=cancelado", conta({ situacao: "teste" }));
      expect(screen.getByRole("status")).toHaveTextContent("Você voltou sem assinar. Nada foi cobrado.");
      await waitFor(() => expect(replaceState).toHaveBeenCalledWith(window.history.state, "", "/e/x/assinatura"));
    });
  });
});

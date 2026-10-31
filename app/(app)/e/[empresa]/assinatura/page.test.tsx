import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLANOS } from "@/lib/planos";
import { adaptarPrecos, type Assinatura, type PrecoDoPlano } from "@/lib/assinatura";
import type { LimitesDaConta } from "@/lib/limites";
import type { Papel } from "@/lib/papel";
import { ProvedorDaConta } from "../conta";
import AssinaturaPage from "./page";

const precos = vi.hoisted(() => ({ atuais: null as PrecoDoPlano[] | null }));
const iniciarCheckout = vi.fn();
vi.mock("./acoes", () => ({
  carregarPrecos: async () => precos.atuais,
  iniciarCheckout: (...args: unknown[]) => iniciarCheckout(...args),
}));

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
    <ProvedorDaConta preferencias={null} assinatura={assinatura} papel={papel} limites={limites}>
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

beforeEach(() => {
  precos.atuais = CATALOGO;
  iniciarCheckout.mockReset();
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
    expect(screen.getByText("R$ 149,90 · até 5.000 lançamentos por mês")).toBeInTheDocument();
    expect(screen.getByText("Contas conciliadas")).toBeInTheDocument();
    expect(screen.getByText("Sicredi, Sicoob, Itaú e Banco do Brasil")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos em setembro")).toBeInTheDocument();
    expect(screen.getByText("4.218")).toBeInTheDocument();
    expect(screen.getByText("Conferidos contra o razão do Cigam")).toBeInTheDocument();
  });

  it("lists the same plans and prices as the landing, marking the current one", async () => {
    await montar();
    const lista = screen.getByRole("list", { name: "Planos" });
    const planos = within(lista).getAllByRole("listitem");

    expect(planos).toHaveLength(PLANOS.length);
    PLANOS.forEach((plano, i) => {
      expect(within(planos[i]).getByRole("heading", { name: plano.nome })).toBeInTheDocument();
      expect(within(planos[i]).getByText(plano.preco)).toBeInTheDocument();
      expect(within(planos[i]).getByText(plano.limite)).toBeInTheDocument();
    });

    const atual = planos.find((item) => within(item).queryByText("Atual"));
    expect(atual).toBeDefined();
    expect(within(atual!).getByRole("heading", { name: "Escala" })).toBeInTheDocument();
    expect(
      within(atual!).getByText("É a sua faixa: 4.218 lançamentos em setembro, quatro bancos."),
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
    // Escala desde agosto; julho foi cobrado no Avançado
    expect(within(linhas[1]).getByText("12 de setembro")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("R$ 149,90")).toBeInTheDocument();
    expect(within(linhas[3]).getByText("R$ 99,90")).toBeInTheDocument();
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
    const cartao = (nome: string) => planos().find((item) => within(item).queryByRole("heading", { name: nome }))!;

    it("no teste: os três planos para assinar, os dias no cabeçalho e o Volume para falar com a gente", async () => {
      await montar(conta({ situacao: "teste", testeTerminaEm: emDias(9.5).slice(0, 10), fimDoTeste: emDias(9.5) }));
      expect(screen.getByText(/^teste grátis · faltam \d+ dias$/)).toBeInTheDocument();
      expect(planos().map((item) => within(item).getByRole("heading").textContent)).toEqual(["Essencial", "Padrão", "Avançado", "Volume"]);
      expect(within(cartao("Padrão")).getByText("R$ 299,00")).toBeInTheDocument();
      expect(within(cartao("Padrão")).getByRole("button", { name: "Assinar o Padrão" })).toBeEnabled();
      expect(within(cartao("Volume")).getByRole("link", { name: "Fale com a gente" })).toHaveAttribute("href", "mailto:ledgrtech@gmail.com");
      // nada da demonstração
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancelar assinatura" })).not.toBeInTheDocument();
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
      expect(screen.getByRole("alert")).toHaveTextContent(
        "O último pagamento não passou. A Stripe vai tentar de novo nos próximos dias; para trocar o cartão, fale com a gente.",
      );
      expect(within(cartao("Padrão")).getByText("Plano atual")).toBeInTheDocument();
    });

    it("assinando: o plano, o período e a renovação no cabeçalho, e só o plano atual marcado", async () => {
      const cobranca = { status: "active", plano: "padrao" as const, periodo: "anual" as const, periodoAtualFim: "2027-10-31", cancelaNoFim: false };
      const { unmount } = await montar(conta({ situacao: "ativo", plano: "padrao", cobranca }));
      expect(screen.getByText("plano Padrão · anual · renova em 31/10")).toBeInTheDocument();
      expect(within(cartao("Padrão")).getByText("Plano atual")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Assinar/ })).not.toBeInTheDocument();
      unmount();

      await montar(conta({ situacao: "ativo", plano: "padrao", cobranca: { ...cobranca, cancelaNoFim: true } }));
      expect(screen.getByText("plano Padrão · anual · termina em 31/10")).toBeInTheDocument();
    });

    it("o período troca os preços, o valor por mês e o desconto dos três cartões", async () => {
      const user = userEvent.setup();
      await montar(conta({ situacao: "teste" }));
      expect(screen.getByRole("button", { name: "Mensal" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("button", { name: "Trimestral" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Anual" }));
      expect(within(cartao("Essencial")).getByText("R$ 1.520,00")).toBeInTheDocument();
      expect(within(cartao("Essencial")).getByText("R$ 126,67 por mês")).toBeInTheDocument();
      expect(within(cartao("Essencial")).getByText("15% a menos que o mensal")).toBeInTheDocument();
      expect(within(cartao("Avançado")).getByText("R$ 6.100,00")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Ver outros períodos" }));
      await user.click(screen.getByRole("button", { name: "Semestral" }));
      expect(within(cartao("Padrão")).getByText("R$ 1.615,00")).toBeInTheDocument();
    });

    it("sem os preços da Stripe, mostra os de referência, sem período, e o Assinar desligado", async () => {
      precos.atuais = null;
      await montar(conta({ situacao: "teste" }));
      expect(screen.queryByRole("button", { name: "Anual" })).not.toBeInTheDocument();
      const assinar = within(cartao("Padrão")).getByRole("button", { name: "Assinar o Padrão" });
      expect(assinar).toBeDisabled();
      expect(assinar).toHaveAccessibleDescription("A assinatura pelo cartão ainda não está no ar.");
      expect(within(cartao("Padrão")).getByText(PLANOS.find((p) => p.nome === "Padrão")!.preco)).toBeInTheDocument();
    });

    it("um período que falta para um plano só desliga esse cartão", async () => {
      precos.atuais = CATALOGO.filter((p) => !(p.plano === "avancado" && p.periodo === "anual"));
      const user = userEvent.setup();
      await montar(conta({ situacao: "teste" }));
      await user.click(screen.getByRole("button", { name: "Anual" }));
      expect(within(cartao("Avançado")).getByText("Indisponível neste período")).toBeInTheDocument();
      expect(within(cartao("Avançado")).getByRole("button", { name: "Assinar o Avançado" })).toBeDisabled();
      expect(within(cartao("Padrão")).getByRole("button", { name: "Assinar o Padrão" })).toBeEnabled();
    });

    it("gestor e analista veem os planos, mas só o administrador assina", async () => {
      await montar(conta({ situacao: "teste" }), { papel: "gestor" });
      const assinar = within(cartao("Padrão")).getByRole("button", { name: "Assinar o Padrão" });
      expect(assinar).toBeDisabled();
      expect(assinar).toHaveAccessibleDescription("Só o administrador da conta assina.");
    });

    it("mostra a franquia de conciliações do mês", async () => {
      await montar(conta({ situacao: "teste" }), { limites: { empresas: null, usuarios: null, conciliacoes: { usadas: 3, maximo: 20 } } });
      expect(screen.getByText("3 de 20 conciliações este mês")).toBeInTheDocument();
    });

    it("ativo sem a cobrança da Stripe (o piloto ativado à mão) segue a tela de demonstração", async () => {
      await montar(conta({ situacao: "ativo", plano: "padrao" }));
      expect(screen.getByText("Plano atual", { selector: ".dash-rotulo" })).toBeInTheDocument();
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });
});

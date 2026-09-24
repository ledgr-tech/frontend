import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PLANOS } from "@/lib/planos";
import AssinaturaPage from "./page";

const AVISO =
  "A cobrança ainda não está no ar. Plano e faturas desta tela são de demonstração, e nada é alterado por aqui.";

function linhasDasFaturas() {
  const tabela = screen.getByRole("table");
  // a primeira linha é o cabeçalho
  return within(tabela).getAllByRole("row").slice(1);
}

describe("AssinaturaPage", () => {
  it("shows the current plan and the renewal date under the title", () => {
    render(<AssinaturaPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Assinatura" })).toBeInTheDocument();
    expect(screen.getByText("Plano Escala · renova em 12 de outubro")).toBeInTheDocument();
  });

  it("summarises the plan, the accounts and September's volume", () => {
    render(<AssinaturaPage />);
    // "Plano atual" também é o botão do cartão do plano; aqui é o rótulo do resumo
    expect(screen.getByText("Plano atual", { selector: ".dash-rotulo" })).toBeInTheDocument();
    expect(screen.getByText("R$ 149,90 · até 5.000 lançamentos por mês")).toBeInTheDocument();
    expect(screen.getByText("Contas conciliadas")).toBeInTheDocument();
    expect(screen.getByText("Sicredi, Sicoob, Itaú e Banco do Brasil")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos em setembro")).toBeInTheDocument();
    expect(screen.getByText("4.218")).toBeInTheDocument();
    expect(screen.getByText("Conferidos contra o razão do Cigam")).toBeInTheDocument();
  });

  it("lists the same plans and prices as the landing, marking the current one", () => {
    render(<AssinaturaPage />);
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
      within(atual!).getByText("É a faixa da Telha Certa: 4.218 lançamentos em setembro, quatro bancos."),
    ).toBeInTheDocument();
    expect(within(atual!).getByRole("button", { name: "Plano atual" })).toBeDisabled();
  });

  it("lists the invoices newest first, with the landing's prices", () => {
    render(<AssinaturaPage />);
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

  it("colours paid invoices as settled and leaves the upcoming one neutral", () => {
    render(<AssinaturaPage />);
    const [outubro, setembro] = linhasDasFaturas();

    expect(within(setembro).getByText("Paga")).toHaveClass("selo", "selo-ok");
    const aVencer = within(outubro).getByText("A vencer");
    expect(aVencer).toHaveClass("selo");
    expect(aVencer).not.toHaveClass("selo-ok");
  });

  it("offers a receipt only for paid invoices", () => {
    render(<AssinaturaPage />);
    const [outubro, setembro] = linhasDasFaturas();

    expect(within(setembro).getByRole("button", { name: "Recibo de setembro de 2026 em PDF" })).toBeInTheDocument();
    expect(within(outubro).queryByRole("button")).not.toBeInTheDocument();
    expect(within(outubro).getByText("—")).toBeInTheDocument();
  });

  it("says billing is not live and keeps every billing change disabled, pointing to why", () => {
    render(<AssinaturaPage />);
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

  it("opens the cancel confirmation with focus on keeping the subscription", async () => {
    const user = userEvent.setup();
    render(<AssinaturaPage />);

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    const dialogo = screen.getByRole("dialog", { name: "Cancelar a assinatura desta empresa?" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialogo).getByText(
        "O histórico de setembro continua acessível por doze meses, mas nenhum extrato novo poderá ser conciliado a partir de 12 de outubro.",
      ),
    ).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Manter assinatura" })).toHaveFocus();
  });

  it("never confirms the cancellation, and says why next to the button", async () => {
    const user = userEvent.setup();
    render(<AssinaturaPage />);

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));

    const dialogo = screen.getByRole("dialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Cancelar mesmo assim" });
    expect(confirmar).toBeDisabled();
    expect(confirmar).toHaveAccessibleDescription("A cobrança ainda não está no ar: nada é cancelado por aqui.");
    expect(within(dialogo).getByText("A cobrança ainda não está no ar: nada é cancelado por aqui.")).toBeInTheDocument();
  });

  it("closes on Escape and hands focus back to the button that opened it", async () => {
    const user = userEvent.setup();
    render(<AssinaturaPage />);
    const abrir = screen.getByRole("button", { name: "Cancelar assinatura" });

    await user.click(abrir);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("closes on Manter assinatura", async () => {
    const user = userEvent.setup();
    render(<AssinaturaPage />);

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await user.click(screen.getByRole("button", { name: "Manter assinatura" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar assinatura" })).toHaveFocus();
  });

  it("keeps Tab inside the dialog while it is open", async () => {
    const user = userEvent.setup();
    render(<AssinaturaPage />);

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    const manter = screen.getByRole("button", { name: "Manter assinatura" });

    await user.tab();
    expect(manter).toHaveFocus();
    await user.tab({ shift: true });
    expect(manter).toHaveFocus();
  });

  it("closes when the backdrop is clicked, but not when the dialog itself is", async () => {
    const user = userEvent.setup();
    render(<AssinaturaPage />);

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    await user.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByTestId("assinatura-fundo"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

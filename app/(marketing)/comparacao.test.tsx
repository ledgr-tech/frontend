import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { JanelaDaConciliacao, type LinhaExtrato } from "./comparacao";

// o painel é o do app (PainelDoExtrato), que pede o roteador; a janela nunca navega
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PAGAMENTO: LinhaExtrato = {
  data: "04/08",
  desc: "Pagamento fornecedor #1082",
  valorBanco: "R$ 12.640,00",
  valorSistema: "R$ 12.604,00",
  status: "divergente_valor",
  explicacao: "O banco descontou R$ 36,00 de juros por atraso no boleto.",
};
const ALFA: LinhaExtrato = {
  data: "03/08",
  desc: "Recebimento cliente Alfa Comércio",
  valorBanco: "R$ 3.250,00",
  valorSistema: "R$ 3.250,00",
  status: "match_exato",
  explicacao: null,
};
const TARIFA: LinhaExtrato = {
  data: "06/08",
  desc: "Tarifa de manutenção da conta",
  valorBanco: "R$ 45,00",
  valorSistema: null,
  status: "tarifa_bancaria",
  explicacao: "O banco cobrou essa tarifa em 06/08.",
};
const ALUGUEL_BANCO: LinhaExtrato = {
  data: "11/08",
  desc: "Aluguel sede agosto",
  valorBanco: "R$ 9.800,00",
  valorSistema: "R$ 9.800,00",
  status: "divergente_data",
  explicacao: "Mesmo valor, datas diferentes.",
};
const ALUGUEL_SISTEMA: LinhaExtrato = { ...ALUGUEL_BANCO, data: "12/08" };

const SALDO = { inicial: 52380.47, final: 61904.12, data: "2026-08-31" };

function montar() {
  render(
    <JanelaDaConciliacao
      banco={[TARIFA, PAGAMENTO, ALUGUEL_BANCO, ALFA]}
      sistema={[PAGAMENTO, ALUGUEL_SISTEMA, ALFA]}
      saldo={SALDO}
      destaque="Pagamento fornecedor #1082"
    />,
  );
}

const painel = () => within(screen.getByRole("complementary", { name: "Detalhe da linha e saldo do extrato" }));
const linha = (desc: string) =>
  [...document.querySelectorAll<HTMLElement>("tbody tr")].find((tr) => tr.textContent?.includes(desc))!;
const descricoes = () => [...document.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td:nth-child(2)")!.textContent);

describe("JanelaDaConciliacao", () => {
  it("draws the app's comparison in a Mac window: the filters, the two sheets with Conferida and the panel", () => {
    montar();
    expect(document.querySelectorAll(".vitrine-barra > span")).toHaveLength(3);
    expect(screen.getByText("Comparação direta · agosto/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos (4)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Só revisão (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Justificadas (0)" })).toBeInTheDocument();
    expect(screen.getByText("0 de 3 conferidas")).toBeInTheDocument();
    expect([...document.querySelectorAll("thead tr:last-child th")].map((th) => th.textContent?.replace(/[▲▼↕]/g, ""))).toEqual([
      "Data",
      "Descrição",
      "Banco",
      "Status",
      "Data",
      "Descrição",
      "Sistema",
      "Conferida",
    ]);
    // ordenada pela data, como a comparação abre
    expect(descricoes()).toEqual(["Recebimento cliente Alfa Comércio", "Pagamento fornecedor #1082", "Tarifa de manutenção da conta", "Aluguel sede agosto"]);
    // o saldo do arquivo, embaixo do painel
    expect(painel().getByText("R$ 61.904,12")).toBeInTheDocument();
  });

  it("marks the diverging field, the missing side and the other day as the app does", () => {
    montar();
    expect(within(linha("Pagamento fornecedor #1082")).getByText("R$ 12.604,00")).toHaveClass("marca-diverge");
    expect(within(linha("Tarifa de manutenção da conta")).getByText("sem lançamento no sistema")).toBeInTheDocument();
    expect(within(linha("Aluguel sede agosto")).getByText("12/08")).toHaveClass("marca-diverge");
    expect(within(linha("Recebimento cliente Alfa Comércio")).getByText("Conciliado")).toHaveClass("selo", "selo-ok");
  });

  it("opens with the highlighted line in the panel, follows the pointer and keeps the clicked one", () => {
    montar();
    expect(painel().getByText("Em foco")).toBeInTheDocument();
    expect(painel().getByRole("heading", { name: "Pagamento fornecedor #1082" })).toBeInTheDocument();
    expect(painel().getByText(/juros por atraso/)).toBeInTheDocument();
    expect(painel().getByText("R$ 36,00")).toBeInTheDocument();

    fireEvent.mouseEnter(linha("Aluguel sede agosto"));
    expect(painel().getByRole("heading", { name: "Aluguel sede agosto" })).toBeInTheDocument();

    fireEvent.click(linha("Tarifa de manutenção da conta"));
    expect(painel().getByText("Fixado")).toBeInTheDocument();
    fireEvent.mouseEnter(linha("Recebimento cliente Alfa Comércio"));
    expect(painel().getByRole("heading", { name: "Tarifa de manutenção da conta" })).toBeInTheDocument();
    expect(linha("Tarifa de manutenção da conta")).toHaveAttribute("data-fixo");
  });

  it("counts a checked divergence and takes the color off its line", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Marcar Pagamento fornecedor #1082 como conferida" }));
    expect(screen.getByText("1 de 3 conferidas")).toBeInTheDocument();
    expect(linha("Pagamento fornecedor #1082")).toHaveAttribute("data-tom", "neutro");
    expect(screen.getByRole("button", { name: "Marcar Pagamento fornecedor #1082 como conferida" })).toHaveAttribute("aria-pressed", "true");
  });

  it("justifies the line in the panel, which leaves the review for Justificadas", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(painel().getByRole("button", { name: "Justificar" }));
    await usuario.type(painel().getByLabelText("Justificativa"), "Juros do boleto pago com atraso.");
    await usuario.click(painel().getByRole("button", { name: "Justificar" }));

    expect(within(linha("Pagamento fornecedor #1082")).getByText("Justificada")).toBeInTheDocument();
    expect(painel().getByText(/^Justificada por você em/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Só revisão (2)" })).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Justificadas (1)" }));
    expect(descricoes()).toEqual(["Pagamento fornecedor #1082"]);
  });

  it("filters the review, sorts by a column and switches the density", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole("button", { name: "Só revisão (3)" }));
    expect(descricoes()).not.toContain("Recebimento cliente Alfa Comércio");

    await usuario.click(screen.getByRole("button", { name: "Todos (4)" }));
    await usuario.click(screen.getByRole("button", { name: /^Banco/ }));
    expect(descricoes()[0]).toBe("Tarifa de manutenção da conta");
    await usuario.click(screen.getByRole("button", { name: /^Banco/ }));
    expect(descricoes()[0]).toBe("Pagamento fornecedor #1082");

    await usuario.click(screen.getByRole("button", { name: "Compacta" }));
    expect(document.querySelector(".janela-conciliacao")).toHaveAttribute("data-densidade", "compacta");
  });

  it("opens on the review on a phone, where the table turns into cards, until a filter is chosen", async () => {
    const usuario = userEvent.setup();
    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) =>
      ({ matches: consulta === "(max-width: 680px)", addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList) as typeof window.matchMedia;
    try {
      montar();
      expect(screen.getByRole("button", { name: "Só revisão (3)" })).toHaveAttribute("aria-pressed", "true");
      expect(descricoes()).not.toContain("Recebimento cliente Alfa Comércio");
      await usuario.click(screen.getByRole("button", { name: "Todos (4)" }));
      expect(descricoes()).toContain("Recebimento cliente Alfa Comércio");
    } finally {
      window.matchMedia = original;
    }
  });
});

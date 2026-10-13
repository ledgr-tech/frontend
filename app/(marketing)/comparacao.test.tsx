import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { seloDoStatus } from "@/app/(app)/dashboard/resumo";
import { ExtratoComparacao, type LinhaExtrato } from "./comparacao";

const LINHA: LinhaExtrato = {
  data: "04/10",
  desc: "Pagamento fornecedor #1082",
  valorBanco: "R$ 12.640,00",
  valorSistema: "R$ 12.604,00",
  status: "divergente_valor",
  explicacao: "O banco descontou juros por atraso.",
};

const BATIDA: LinhaExtrato = {
  data: "03/10",
  desc: "Recebimento cliente Alfa Comércio",
  valorBanco: "R$ 3.250,00",
  valorSistema: "R$ 3.250,00",
  status: "match_exato",
  explicacao: null,
};

const linhaDoBanco = () => screen.getByRole("button", { name: "Pagamento fornecedor #1082" });
const linhaDaTabela = (desc: string) =>
  [...document.querySelectorAll<HTMLElement>("tbody tr")].find((linha) => linha.textContent?.includes(desc))!;

describe("ExtratoComparacao", () => {
  describe("drawn as the app's comparison table", () => {
    it("puts the bank statement and the management system in two sheets, with the app's columns", () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
      const tabela = screen.getByRole("table");
      expect(tabela).toHaveClass("table", "tabela-folhas");
      expect(within(tabela).getByText("Extrato do banco")).toHaveClass("folha-nome");
      expect(within(tabela).getByText("Sistema de gestão")).toHaveClass("folha-nome");
      expect(within(tabela).getByText("Fonte da verdade")).toHaveClass("folha-etiqueta");
      expect([...tabela.querySelectorAll("thead tr:last-child th")].map((coluna) => coluna.textContent)).toEqual([
        "Data",
        "Descrição",
        "Banco",
        "Status",
        "Data",
        "Descrição",
        "Sistema",
      ]);
    });

    it("shows each pair in one line, with the verdict in the axis between the two sheets, as the app does", () => {
      render(<ExtratoComparacao banco={[LINHA, BATIDA]} sistema={[LINHA, BATIDA]} />);
      expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
      const tr = linhaDaTabela("Pagamento fornecedor #1082");
      const linha = within(tr);
      expect(linha.getByText("R$ 12.640,00").closest("td")).toHaveClass("folha-banco");
      expect(linha.getByText("R$ 12.604,00").closest("td")).toHaveClass("folha-sistema");
      // o nome curto no selo, o inteiro para o leitor de tela
      const status = tr.querySelector("td.celula-status")!;
      expect(status.previousElementSibling).toHaveClass("folha-banco");
      expect(status.nextElementSibling).toHaveClass("folha-sistema");
      expect(within(status as HTMLElement).getByText("Valor diverge")).toHaveClass("selo", `selo-${seloDoStatus("divergente_valor").tom}`);
      expect(within(status as HTMLElement).getByText("Valor diverge na mesma data")).toHaveClass("sr-only");
    });

    it("leaves a matched line quiet, without a seal, as the app does", () => {
      render(<ExtratoComparacao banco={[BATIDA]} sistema={[BATIDA]} />);
      expect(screen.getByText("Bate")).toHaveClass("status-batido");
      expect(screen.getByText("Match exato")).toHaveClass("sr-only");
    });

    it("marks the diverging field on both sides", () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
      const linha = within(linhaDaTabela("Pagamento fornecedor #1082"));
      expect(linha.getByText("R$ 12.640,00")).toHaveClass("marca-diverge");
      expect(linha.getByText("R$ 12.604,00")).toHaveClass("marca-diverge");
      expect(linha.getAllByText("04/10")[0]).not.toHaveClass("marca-diverge");
    });

    it("shows the missing side as one empty slot, not three dashes", () => {
      const tarifa: LinhaExtrato = { ...LINHA, desc: "Tarifa", valorSistema: null, status: "tarifa_bancaria" };
      render(<ExtratoComparacao banco={[tarifa]} sistema={[]} />);
      expect(screen.getByText("sem lançamento no sistema").closest("td")).toHaveAttribute("colspan", "3");
    });

    it("joins the two sides of a line booked on different days, each with its own date", () => {
      const banco = { ...LINHA, data: "11/08", status: "divergente_data" as const };
      const sistema = { ...LINHA, data: "12/08", status: "divergente_data" as const };
      render(<ExtratoComparacao banco={[banco]} sistema={[sistema]} />);
      const linha = within(linhaDaTabela("Pagamento fornecedor #1082"));
      expect(linha.getByText("11/08").closest("td")).toHaveClass("folha-banco");
      expect(linha.getByText("12/08").closest("td")).toHaveClass("folha-sistema");
    });

    it("lays the lines out as cards on the phone, with the app's field labels", () => {
      const { container } = render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
      expect(container.firstElementChild).toHaveClass("tabela-cartoes");
      const celulas = [...linhaDaTabela("Pagamento fornecedor #1082").querySelectorAll("td[data-rotulo]")];
      expect(celulas.map((celula) => celula.getAttribute("data-rotulo"))).toEqual([
        "Data",
        "Descrição",
        "Banco",
        "Status",
        "Data no sistema",
        "Descrição no sistema",
        "Sistema",
      ]);
      // a descrição do banco é o título do cartão
      expect(linhaDaTabela("Pagamento fornecedor #1082").querySelector('td[data-destaque="true"]')).toHaveTextContent(
        "Pagamento fornecedor #1082",
      );
    });
  });

  describe("the app's hover card", () => {
    it("shows the divergence details when hovering a mismatched line", () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

      fireEvent.mouseEnter(linhaDoBanco());

      const cartao = screen.getByRole("tooltip");
      expect(cartao).toHaveClass("cartao-lancamento");
      expect(cartao).toHaveTextContent("Lançamento · Valor diverge na mesma data");
      // no formato do cartão do app: a data de cada lado junto do valor
      expect(cartao).toHaveTextContent("04/10 · R$ 12.604,00");
      expect(cartao).toHaveTextContent("juros por atraso");
      expect(linhaDoBanco()).toHaveAttribute("aria-describedby", cartao.id);
    });

    it("marks the explanation as written by the AI, like the product does", () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

      fireEvent.mouseEnter(linhaDoBanco());

      expect(screen.getByRole("tooltip")).toHaveTextContent("Gerada por IA · confira antes de decidir");
    });

    it("lights the open line, as the app's hover does", () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
      expect(linhaDaTabela("Pagamento fornecedor #1082")).not.toHaveAttribute("data-aberta");

      fireEvent.focus(linhaDoBanco());

      expect(linhaDaTabela("Pagamento fornecedor #1082")).toHaveAttribute("data-aberta");
    });

    it("hides the details when the mouse leaves", async () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
      fireEvent.mouseEnter(linhaDoBanco());

      fireEvent.mouseLeave(linhaDoBanco());

      await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    });

    it("opens on a tap, since touch has no hover", () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

      fireEvent.click(linhaDoBanco());

      expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    it("opens on keyboard focus and closes on Escape", async () => {
      render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);

      fireEvent.focus(linhaDoBanco());
      expect(screen.getByRole("tooltip")).toBeInTheDocument();

      fireEvent.keyDown(linhaDoBanco(), { key: "Escape" });

      await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    });

    it("leaves a matched line alone: no card, nothing to click", () => {
      render(<ExtratoComparacao banco={[BATIDA]} sistema={[BATIDA]} />);

      fireEvent.mouseEnter(linhaDaTabela("Recebimento cliente Alfa Comércio"));

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("marks itself as explored once a line is opened, so the hover hint can stop", () => {
      const { container } = render(<ExtratoComparacao banco={[LINHA]} sistema={[LINHA]} />);
      const comparacao = container.firstElementChild!;
      expect(comparacao).not.toHaveAttribute("data-explorado");

      fireEvent.mouseEnter(linhaDoBanco());
      fireEvent.mouseLeave(linhaDoBanco());

      expect(comparacao).toHaveAttribute("data-explorado");
    });

    describe("moving from one line to the next", () => {
      const OUTRA: LinhaExtrato = { ...LINHA, desc: "Crédito cartão D+30", explicacao: "Taxa de arredondamento." };
      const linhaDe = (desc: string) => screen.getByRole("button", { name: new RegExp(desc) });

      afterEach(() => vi.restoreAllMocks());

      it("lets the first card rise in", () => {
        render(<ExtratoComparacao banco={[LINHA, OUTRA]} sistema={[LINHA, OUTRA]} />);

        fireEvent.mouseEnter(linhaDe("Pagamento fornecedor"));

        expect(screen.getByRole("tooltip")).not.toHaveAttribute("data-na-hora");
      });

      it("opens the next card at once when the pointer goes straight to another line", () => {
        render(<ExtratoComparacao banco={[LINHA, OUTRA]} sistema={[LINHA, OUTRA]} />);
        fireEvent.mouseEnter(linhaDe("Pagamento fornecedor"));

        fireEvent.mouseLeave(linhaDe("Pagamento fornecedor"));
        fireEvent.mouseEnter(linhaDe("Crédito cartão"));

        expect(screen.getByRole("tooltip")).toHaveTextContent("Crédito cartão D+30");
        expect(screen.getByRole("tooltip")).toHaveAttribute("data-na-hora");
      });

      it("rises in again when the pointer comes back after a pause", () => {
        const agora = vi.spyOn(performance, "now").mockReturnValue(1000);
        render(<ExtratoComparacao banco={[LINHA, OUTRA]} sistema={[LINHA, OUTRA]} />);
        fireEvent.mouseEnter(linhaDe("Pagamento fornecedor"));
        fireEvent.mouseLeave(linhaDe("Pagamento fornecedor"));

        agora.mockReturnValue(1600);
        fireEvent.mouseEnter(linhaDe("Crédito cartão"));

        expect(screen.getByRole("tooltip")).not.toHaveAttribute("data-na-hora");
      });
    });
  });
});

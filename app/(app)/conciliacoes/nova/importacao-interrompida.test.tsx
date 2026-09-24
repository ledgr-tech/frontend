import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { analisarCsv, type Analise } from "@/lib/csv-extrato";
import { ImportacaoInterrompida } from "./importacao-interrompida";
import { lerBytes } from "./ler-arquivo";

async function texto(arquivo: File) {
  return new TextDecoder().decode(await lerBytes(arquivo));
}

// O layout do design: débito e crédito separados, vírgula decimal, sem "valor".
const CIGAM = [
  "DT_LANC;HISTORICO;DOC;DEB;CRED;CTA_CONTABIL",
  "04/09/2026;Boleto Aço Norte;00071.4482-9;12.604,00;0,00;2.01.01",
  "05/09/2026;Repasse cartão D+30;4471;0,00;7.912,40;1.01.02",
  "15/09/2026;Folha de setembro;FP-09;38.420,17;0,00;3.01.01",
].join("\n");

type Parada = Extract<Analise, { motivo: "colunas" | "formato" }>;

function analise(csv: string): Parada {
  const resultado = analisarCsv(new TextEncoder().encode(csv));
  if (resultado.pronto || resultado.motivo === "ilegivel") throw new Error("fixture devia parar");
  return resultado;
}

function montar(csv = CIGAM, origem: "banco" | "sistema" = "sistema") {
  const onPronto = vi.fn<(arquivo: File) => void>();
  const onOutroArquivo = vi.fn();
  render(
    <ImportacaoInterrompida
      nome="razao-092026.csv"
      origem={origem}
      analise={analise(csv)}
      onPronto={onPronto}
      onOutroArquivo={onOutroArquivo}
    />,
  );
  return { onPronto, onOutroArquivo, user: userEvent.setup() };
}

function coluna(nome: string) {
  return within(screen.getByRole("group", { name: `Papel da coluna ${nome}` }));
}

async function apontarDebitoECredito(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Apontar as colunas" }));
  await user.click(coluna("DEB").getByRole("button", { name: "Valor" }));
  await user.click(coluna("CRED").getByRole("button", { name: "Valor" }));
}

describe("ImportacaoInterrompida", () => {
  describe("diagnóstico", () => {
    it("says what is missing, and that nothing was sent", () => {
      montar();
      expect(screen.getByText("Importação interrompida")).toBeInTheDocument();
      expect(screen.getByText("razao-092026.csv · 3 linhas · ponto e vírgula")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Não deu para conciliar" })).toBeInTheDocument();
      expect(
        screen.getByText(/O arquivo do sistema não tem uma coluna de valor reconhecível\. Nada foi enviado\./),
      ).toBeInTheDocument();
    });

    it("lists each column with how it was read and its first line", () => {
      montar();
      const linha = (nome: string) => within(screen.getByRole("row", { name: new RegExp(`^${nome} `) }));

      expect(linha("DT_LANC").getByText("Data")).toBeInTheDocument();
      expect(linha("DT_LANC").getByText("04/09/2026")).toBeInTheDocument();
      expect(linha("DT_LANC").getByText("Reconhecida")).toBeInTheDocument();
      expect(linha("HISTORICO").getByText("Histórico")).toBeInTheDocument();
      expect(linha("DEB").getByText("Ambígua")).toBeInTheDocument();
      expect(linha("DEB").getByText("12.604,00")).toBeInTheDocument();
      expect(linha("CTA_CONTABIL").getByText("Não usada")).toBeInTheDocument();
    });

    it("explains a file whose columns are right but whose numbers are not", () => {
      montar("data;valor;descricao\n04/09/2026;1.500,75;Pix\n");
      expect(screen.getByText(/os valores ou as datas estão num formato que o Ledgr ainda não lê direto/)).toBeInTheDocument();
    });

    it("lets the person pick another file instead", async () => {
      const { onOutroArquivo, user } = montar();
      await user.click(screen.getByRole("button", { name: "Subir outro arquivo" }));
      expect(onOutroArquivo).toHaveBeenCalledTimes(1);
    });
  });

  describe("mapeamento", () => {
    it("starts from what was recognized and holds the button until value is pointed", async () => {
      const { user } = montar();
      await user.click(screen.getByRole("button", { name: "Apontar as colunas" }));

      expect(screen.getByRole("heading", { name: "De quais colunas o Ledgr precisa" })).toBeInTheDocument();
      expect(coluna("DT_LANC").getByRole("button", { name: "Data" })).toHaveAttribute("aria-pressed", "true");
      expect(coluna("HISTORICO").getByRole("button", { name: "Histórico" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Falta apontar a coluna de valor.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar mapeamento" })).toBeDisabled();
    });

    it("joins debit and credit into one value column, debit negative", async () => {
      const { user } = montar();
      await apontarDebitoECredito(user);

      expect(screen.getByText("Débito e crédito serão unidos em uma coluna de valor.")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /Débito negativo, crédito positivo/ })).toBeChecked();
      const previa = within(screen.getByRole("table", { name: "Como o Ledgr vai ler" }));
      expect(previa.getByText("-R$ 12.604,00")).toBeInTheDocument();
      expect(previa.getByText("R$ 7.912,40")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar mapeamento" })).toBeEnabled();
    });

    it("keeps the signs from the file when the option is off", async () => {
      const { user } = montar();
      await apontarDebitoECredito(user);
      await user.click(screen.getByRole("checkbox", { name: /Débito negativo, crédito positivo/ }));

      const previa = within(screen.getByRole("table", { name: "Como o Ledgr vai ler" }));
      expect(previa.getByText("R$ 12.604,00")).toBeInTheDocument();
    });

    it("moves the date to the column just pointed, since there is only one", async () => {
      const { user } = montar();
      await user.click(screen.getByRole("button", { name: "Apontar as colunas" }));
      await user.click(coluna("DOC").getByRole("button", { name: "Data" }));

      expect(coluna("DOC").getByRole("button", { name: "Data" })).toHaveAttribute("aria-pressed", "true");
      expect(coluna("DT_LANC").getByRole("button", { name: "Data" })).toHaveAttribute("aria-pressed", "false");
    });

    it("shows the missing column in the preview", async () => {
      const { user } = montar();
      await user.click(screen.getByRole("button", { name: "Apontar as colunas" }));
      const previa = within(screen.getByRole("table", { name: "Como o Ledgr vai ler" }));
      expect(previa.getAllByText("sem coluna").length).toBeGreaterThan(0);
    });

    it("rewrites the file in the format the backend reads, keeping its name", async () => {
      const { onPronto, user } = montar();
      await apontarDebitoECredito(user);
      await user.click(screen.getByRole("button", { name: "Confirmar mapeamento" }));

      expect(onPronto).toHaveBeenCalledTimes(1);
      const arquivo = onPronto.mock.calls[0][0];
      expect(arquivo.name).toBe("razao-092026.csv");
      expect(await texto(arquivo)).toBe(
        [
          "data;valor;descricao",
          "2026-09-04;-12604.00;Boleto Aço Norte",
          "2026-09-05;7912.40;Repasse cartão D+30",
          "2026-09-15;-38420.17;Folha de setembro",
          "",
        ].join("\n"),
      );
    });

    it("tells which lines stay out, and still lets the rest go", async () => {
      const { onPronto, user } = montar(`${CIGAM}\nontem;Linha estragada;0;1,00;0,00;0`);
      await apontarDebitoECredito(user);

      expect(screen.getByText("3 linhas prontas para conciliar. 1 fica de fora.")).toBeInTheDocument();
      expect(screen.getByText('Linha 5: Data que não dá para ler: "ontem".')).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Confirmar mapeamento" }));
      expect(await texto(onPronto.mock.calls[0][0])).not.toContain("Linha estragada");
    });

    it("does not let every line stay out", async () => {
      const { user } = montar("DT;HIST;VALOR\nontem;Pix;1,00\n");
      await user.click(screen.getByRole("button", { name: "Apontar as colunas" }));

      expect(screen.getByText("Nenhuma linha dá para ler com esse mapeamento.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirmar mapeamento" })).toBeDisabled();
    });
  });
});

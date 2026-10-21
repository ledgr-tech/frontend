import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaixaDoSaldo, fraseDoSaldoFinal } from "./saldo";

// o Intl separa o "R$" do número com um espaço que não quebra
const semEspacoFixo = (texto: string | null) => texto?.replace(/ /g, " ");

describe("FaixaDoSaldo", () => {
  it("mostra o saldo inicial, o final e a data do extrato do banco", () => {
    render(<FaixaDoSaldo saldo={{ inicial: 750.25, final: 1000, data: "2026-09-10" }} />);
    const faixa = screen.getByRole("region", { name: "Saldo do extrato do banco" });
    expect(semEspacoFixo(faixa.textContent)).toBe("Saldo inicialR$ 750,25Saldo finalR$ 1.000,00Data do saldo10/09/2026");
  });

  it("com o saldo negativo, mostra o sinal", () => {
    render(<FaixaDoSaldo saldo={{ inicial: 100, final: -250.75, data: "2026-09-30" }} />);
    expect(semEspacoFixo(screen.getByRole("region").textContent)).toContain("Saldo final-R$ 250,75");
  });

  it("com linhas não lidas, diz que o saldo inicial depende delas em vez de calcular", () => {
    render(<FaixaDoSaldo saldo={{ inicial: null, final: 1249.25, data: "2026-09-10" }} />);
    expect(screen.getByText("depende das linhas não lidas")).toBeInTheDocument();
  });

  it("sem saldo no arquivo, avisa em vez de mostrar R$ 0,00", () => {
    render(<FaixaDoSaldo saldo={null} />);
    expect(screen.getByRole("region")).toHaveTextContent("Saldo não informado no arquivo");
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("sem os campos no backend, não mostra nada", () => {
    const { container } = render(<FaixaDoSaldo saldo={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("o saldo final numa frase", () => {
  it("leva o valor e a data, ou o aviso", () => {
    expect(semEspacoFixo(fraseDoSaldoFinal({ inicial: 0, final: 1120, data: "2026-09-07" }))).toBe(
      "Saldo final de R$ 1.120,00 em 07/09/2026",
    );
    expect(fraseDoSaldoFinal(null)).toBe("Saldo não informado no arquivo");
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaixaDoSaldo, SaldoDaFolha, fraseDoSaldoFinal } from "./saldo";

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

describe("SaldoDaFolha", () => {
  it("mostra o saldo inicial e o valor", () => {
    const { container } = render(
      <SaldoDaFolha saldo={{ inicial: 1000, final: -250.75, data: "2026-09-30" }} momento="inicial" />,
    );
    expect(container).toHaveTextContent("Saldo inicial");
    expect(container.querySelector("strong")).toHaveTextContent("R$ 1.000,00");
  });

  it("mostra o saldo final com a data e o sinal", () => {
    const { container } = render(
      <SaldoDaFolha saldo={{ inicial: 1000, final: -250.75, data: "2026-09-30" }} momento="final" />,
    );
    expect(container).toHaveTextContent("Saldo final em 30/09/2026");
    expect(container.querySelector("strong")).toHaveTextContent("-R$ 250,75");
  });

  it("avisa que o saldo inicial depende das linhas não lidas", () => {
    const { container } = render(
      <SaldoDaFolha saldo={{ inicial: null, final: 1249.25, data: "2026-09-10" }} momento="inicial" />,
    );
    expect(container).toHaveTextContent("depende das linhas não lidas");
  });

  it("com linhas não lidas, o saldo final aparece normalmente no pé", () => {
    const { container } = render(
      <SaldoDaFolha saldo={{ inicial: null, final: 1249.25, data: "2026-09-10" }} momento="final" />,
    );
    expect(container).toHaveTextContent("Saldo final em 10/09/2026");
    expect(container.querySelector("strong")).toHaveTextContent("R$ 1.249,25");
    expect(container).not.toHaveTextContent("depende das linhas não lidas");
  });

  it("sem saldo no arquivo, avisa nos dois momentos", () => {
    const inicial = render(<SaldoDaFolha saldo={null} momento="inicial" />);
    expect(inicial.container).toHaveTextContent("Saldo não informado no arquivo");
    expect(inicial.container.textContent).not.toMatch(/R\$/);

    const final = render(<SaldoDaFolha saldo={null} momento="final" />);
    expect(final.container).toHaveTextContent("Saldo não informado no arquivo");
    expect(final.container.textContent).not.toMatch(/R\$/);
  });

  it("sem os campos no backend, não mostra nada", () => {
    const { container } = render(<SaldoDaFolha saldo={undefined} momento="inicial" />);
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

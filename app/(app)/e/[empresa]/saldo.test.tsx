import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DiferencaDosSaldos, FaixaDoSaldo, SaldoDaFolha, fraseDoSaldoFinal } from "./saldo";

// o Intl separa o "R$" do número com um espaço que não quebra
const semEspacoFixo = (texto: string | null) => texto?.replace(/ /g, " ");

describe("FaixaDoSaldo", () => {
  it("mostra o saldo inicial, o final e a data do extrato do banco", () => {
    render(<FaixaDoSaldo banco={{ inicial: 750.25, final: 1000, data: "2026-09-10" }} />);
    const faixa = screen.getByRole("region", { name: "Saldo do extrato do banco" });
    expect(semEspacoFixo(faixa.textContent)).toBe("Saldo inicialR$ 750,25Saldo finalR$ 1.000,00Data do saldo10/09/2026");
  });

  it("com o saldo negativo, mostra o sinal", () => {
    render(<FaixaDoSaldo banco={{ inicial: 100, final: -250.75, data: "2026-09-30" }} />);
    expect(semEspacoFixo(screen.getByRole("region").textContent)).toContain("Saldo final-R$ 250,75");
  });

  it("com linhas não lidas, diz que o saldo inicial depende delas em vez de calcular", () => {
    render(<FaixaDoSaldo banco={{ inicial: null, final: 1249.25, data: "2026-09-10" }} />);
    expect(screen.getByText("depende das linhas não lidas")).toBeInTheDocument();
  });

  it("sem saldo no arquivo, avisa em vez de mostrar R$ 0,00", () => {
    render(<FaixaDoSaldo banco={null} />);
    expect(screen.getByRole("region")).toHaveTextContent("Saldo não informado no arquivo");
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("sem os campos no backend, não mostra nada", () => {
    const { container } = render(<FaixaDoSaldo banco={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rotula os dois saldos finais e mostra a diferença sem recalcular", () => {
    render(<FaixaDoSaldo
      banco={{ inicial: 100, final: 1000, data: "2026-09-10" }}
      sistema={{ inicial: 50, final: 900, data: "2026-09-10" }}
      diferenca={{ valor: 12.34, motivo: null }}
    />);
    const faixa = screen.getByRole("region", { name: "Saldos dos extratos" });
    expect(semEspacoFixo(faixa.textContent)).toContain("BancoSaldo final em 10/09/2026 R$ 1.000,00");
    expect(semEspacoFixo(faixa.textContent)).toContain("SistemaSaldo final em 10/09/2026 R$ 900,00");
    expect(semEspacoFixo(faixa.textContent)).toContain("Diferença R$ 12,34");
    expect(faixa).not.toHaveTextContent("Saldo inicial");
  });

  it.each(["banco", "sistema"] as const)("com o saldo do %s null, avisa na linha correspondente", (lado) => {
    const saldo = { inicial: 10, final: 1000, data: "2026-09-10" };
    render(<FaixaDoSaldo banco={lado === "banco" ? null : saldo} sistema={lado === "sistema" ? null : saldo} />);
    const faixa = screen.getByRole("region", { name: "Saldos dos extratos" });
    const rotulo = screen.getByText(lado === "banco" ? "Banco" : "Sistema");
    expect(rotulo.closest("div")).toHaveTextContent("Saldo não informado no arquivo");
    expect(faixa).not.toHaveTextContent(/R\$\s*0,00/);
  });

  it("mostra o sistema mesmo sem o campo do banco", () => {
    render(<FaixaDoSaldo banco={undefined} sistema={{ inicial: null, final: 0, data: "2026-09-10" }} />);
    const faixa = screen.getByRole("region", { name: "Saldos dos extratos" });
    expect(semEspacoFixo(faixa.textContent)).toContain("SistemaSaldo final em 10/09/2026 R$ 0,00");
    expect(screen.queryByText("Banco")).not.toBeInTheDocument();
  });

  it.each([
    { diferenca: { valor: 0, motivo: null }, texto: "Saldos finais batem" },
    { diferenca: { valor: null, motivo: "datas_diferentes" as const }, texto: "Saldos em datas diferentes" },
  ])("usa a mesma regra da diferença para $texto", ({ diferenca, texto }) => {
    render(<FaixaDoSaldo banco={null} sistema={null} diferenca={diferenca} />);
    expect(screen.getByRole("region", { name: "Saldos dos extratos" })).toHaveTextContent(texto);
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

  it("sem saldo no arquivo, avisa só no momento final", () => {
    const inicial = render(<SaldoDaFolha saldo={null} momento="inicial" />);
    expect(inicial.container).toBeEmptyDOMElement();

    const final = render(<SaldoDaFolha saldo={null} momento="final" />);
    expect(final.container).toHaveTextContent("Saldo não informado no arquivo");
    expect(final.container.textContent).not.toMatch(/R\$/);
  });

  it("sem os campos no backend, não mostra nada", () => {
    const { container } = render(<SaldoDaFolha saldo={undefined} momento="inicial" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DiferencaDosSaldos", () => {
  it("sem o campo no backend, não mostra nada", () => {
    const { container } = render(<DiferencaDosSaldos diferenca={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("com diferença zero, diz que os saldos finais batem", () => {
    render(<DiferencaDosSaldos diferenca={{ valor: 0, motivo: null }} />);
    expect(screen.getByText("Saldos finais batem")).toBeInTheDocument();
  });

  it.each([12.34, -12.34])("mostra a diferença recebida com o sinal (%s)", (valor) => {
    const { container } = render(<DiferencaDosSaldos diferenca={{ valor, motivo: null }} />);
    expect(container).toHaveTextContent("Diferença");
    expect(semEspacoFixo(container.querySelector("strong")?.textContent ?? null)).toBe(valor < 0 ? "-R$ 12,34" : "R$ 12,34");
  });

  it("explica quando os saldos são de datas diferentes", () => {
    render(<DiferencaDosSaldos diferenca={{ valor: null, motivo: "datas_diferentes" }} />);
    expect(screen.getByText("Saldos em datas diferentes")).toBeInTheDocument();
  });

  it.each(["sem_saldo_banco", "sem_saldo_sistema", null] as const)("sem diferença por %s, deixa o aviso para a própria folha", (motivo) => {
    const { container } = render(<DiferencaDosSaldos diferenca={{ valor: null, motivo }} />);
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

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SomaDasSelecionadas, anuncioDaSoma } from "./soma-das-selecionadas";

// o Intl separa o "R$" do número com um espaço que não quebra
const semEspacoFixo = (texto: string) => texto.replace(/ /g, " ");

describe("SomaDasSelecionadas", () => {
  it("mostra a tarifa selecionada com a diferença zerada", () => {
    render(
      <SomaDasSelecionadas
        soma={{ quantidade: 3, banco: -240, sistema: -240, diferenca: 0 }}
      />,
    );

    expect(screen.getByText("3 linhas selecionadas")).toBeInTheDocument();
    expect(screen.getByText("Banco").nextElementSibling).toHaveTextContent("-R$ 2,40");
    expect(screen.getByText("Sistema").nextElementSibling).toHaveTextContent("-R$ 2,40");
    expect(screen.getByText("Fecha: a diferença zera")).toHaveClass("selo", "selo-ok");
  });

  it("mostra a diferença positiva e a falta sem sinal", () => {
    render(
      <SomaDasSelecionadas
        soma={{ quantidade: 1, banco: 200, sistema: 0, diferenca: 200 }}
      />,
    );

    expect(screen.getByText("Banco").nextElementSibling).toHaveTextContent("R$ 2,00");
    expect(screen.getByText("Sistema").nextElementSibling).toHaveTextContent("R$ 0,00");
    expect(screen.getByText("Diferença").nextElementSibling).toHaveTextContent("R$ 2,00");
    expect(screen.getByText("Falta R$ 2,00 para zerar")).toBeInTheDocument();
  });

  it("conserva o sinal negativo da diferença", () => {
    render(
      <SomaDasSelecionadas
        soma={{ quantidade: 1, banco: 0, sistema: 200, diferenca: -200 }}
      />,
    );

    expect(screen.getByText("Diferença").nextElementSibling).toHaveTextContent("-R$ 2,00");
    expect(screen.getByText("Falta R$ 2,00 para zerar")).toBeInTheDocument();
  });

  it("usa o singular numa linha", () => {
    render(
      <SomaDasSelecionadas
        soma={{ quantidade: 1, banco: 100, sistema: 100, diferenca: 0 }}
      />,
    );

    expect(screen.getByText("1 linha selecionada")).toBeInTheDocument();
  });

  it("não renderiza nenhuma região sem linhas", () => {
    const { container } = render(
      <SomaDasSelecionadas
        soma={{ quantidade: 0, banco: 0, sistema: 0, diferenca: 0 }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("é uma região com nome, sem aria-live: o anúncio fica no role=status da tela", () => {
    render(
      <SomaDasSelecionadas
        soma={{ quantidade: 1, banco: 100, sistema: 100, diferenca: 0 }}
      />,
    );

    const regiao = screen.getByRole("region", { name: "Soma das selecionadas" });
    expect(regiao).not.toHaveAttribute("aria-live");
  });
});

describe("anuncioDaSoma", () => {
  it("diz quantas e que fecha", () => {
    expect(anuncioDaSoma({ quantidade: 3, banco: -240, sistema: -240, diferenca: 0 })).toBe(
      "3 linhas selecionadas. Fecha: a diferença zera.",
    );
  });

  it("diz quanto falta, sem sinal", () => {
    expect(semEspacoFixo(anuncioDaSoma({ quantidade: 1, banco: 0, sistema: 200, diferenca: -200 }))).toBe(
      "1 linha selecionada. Falta R$ 2,00 para zerar.",
    );
  });

  it("sem seleção, fica em silêncio", () => {
    expect(anuncioDaSoma({ quantidade: 0, banco: 0, sistema: 0, diferenca: 0 })).toBe("");
  });
});

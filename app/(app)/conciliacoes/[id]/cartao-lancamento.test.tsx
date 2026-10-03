import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { LinhaComparacao } from "@/lib/mock-data";
import { CartaoLancamento } from "./cartao-lancamento";

const LINHA: LinhaComparacao = {
  id: "lc-1",
  descricao: "Boleto Aço Norte Bobinas",
  data: "04/09",
  valorBanco: -12640,
  valorSistema: -12604,
  status: "divergente_valor",
  explicacao: "O banco cobrou R$ 36 de juros pelo atraso, que o sistema não lançou.",
  historico: [],
};

/** A célula do status, onde o cartão se ancora: o meio dela é o meio do cartão. */
function celula(left: number, top: number, width = 144, height = 40): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
}

function tela(largura: number, altura = 900) {
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, value: largura });
  Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: altura });
}

describe("CartaoLancamento", () => {
  beforeEach(() => tela(1440));

  it("centers on the status column, above the line, with the arrow pointing at the status", () => {
    render(<CartaoLancamento id="c" aberto={{ linha: LINHA, ancora: celula(600, 500) }} />);
    const cartao = screen.getByRole("tooltip");

    // o meio da coluna fica em 672; o cartão tem 440 de largura
    expect(cartao.style.left).toBe("452px");
    expect(cartao.style.getPropertyValue("--seta-x")).toBe("220px");
    expect(cartao).toHaveAttribute("data-lado", "acima");
    // 10px acima da linha: o vão da seta
    expect(cartao.style.bottom).toBe(`${900 - 500 + 10}px`);
  });

  it("stays inside the screen when the column is near an edge, and the arrow follows the column", () => {
    tela(700);
    const { rerender } = render(<CartaoLancamento id="c" aberto={{ linha: LINHA, ancora: celula(40, 500) }} />);
    expect(screen.getByRole("tooltip").style.left).toBe("16px");
    expect(screen.getByRole("tooltip").style.getPropertyValue("--seta-x")).toBe("96px");

    rerender(<CartaoLancamento id="c" aberto={{ linha: LINHA, ancora: celula(578, 500) }} />);
    // 700 - 440 - 16
    expect(screen.getByRole("tooltip").style.left).toBe("244px");
    expect(screen.getByRole("tooltip").style.getPropertyValue("--seta-x")).toBe("406px");
  });

  it("opens below the line when there is no room above it, counting the top bar", () => {
    // 400px acima da linha não bastam: o cartão tem uns 300 e a barra do topo, 78
    render(<CartaoLancamento id="c" aberto={{ linha: LINHA, ancora: celula(600, 400) }} />);
    const cartao = screen.getByRole("tooltip");
    expect(cartao).toHaveAttribute("data-lado", "abaixo");
    expect(cartao.style.top).toBe(`${440 + 10}px`);
  });

  it("shows the system's own description in full, since the table cuts it to one line", () => {
    const { rerender } = render(
      <CartaoLancamento
        id="c"
        aberto={{ linha: { ...LINHA, descricaoSistema: "NF 4521 - Aço Norte Bobinas Ind. e Com. Ltda - parcela 2/3" }, ancora: celula(600, 500) }}
      />,
    );
    expect(screen.getByText("Descrição no sistema").nextElementSibling).toHaveTextContent(
      "NF 4521 - Aço Norte Bobinas Ind. e Com. Ltda - parcela 2/3",
    );

    // a mesma do banco já está no título: não repete
    rerender(
      <CartaoLancamento id="c" aberto={{ linha: { ...LINHA, descricaoSistema: LINHA.descricao }, ancora: celula(600, 500) }} />,
    );
    expect(screen.queryByText("Descrição no sistema")).not.toBeInTheDocument();
  });

  it("states the difference when the value diverges, the size of the problem at a glance", () => {
    const { rerender } = render(<CartaoLancamento id="c" aberto={{ linha: LINHA, ancora: celula(600, 500) }} />);
    // o Intl separa "R$" do valor com espaço não separável
    expect(screen.getByText("Diferença").nextElementSibling?.textContent?.replace(/\s/g, " ")).toBe("R$ 36,00");

    rerender(
      <CartaoLancamento
        id="c"
        aberto={{ linha: { ...LINHA, status: "divergente_data", valorSistema: -12640 }, ancora: celula(600, 500) }}
      />,
    );
    expect(screen.queryByText("Diferença")).not.toBeInTheDocument();
  });

  it("brings the explanation, marked when the AI wrote it", () => {
    const { rerender } = render(
      <CartaoLancamento id="c" aberto={{ linha: { ...LINHA, explicacaoPorIa: true }, ancora: celula(600, 500) }} />,
    );
    const cartao = screen.getByRole("tooltip");
    expect(cartao).toHaveTextContent("Lançamento · Valor diverge na mesma data");
    expect(cartao).toHaveTextContent("O banco cobrou R$ 36 de juros pelo atraso, que o sistema não lançou.");
    expect(screen.getByText("Gerada por IA · confira antes de decidir")).toBeInTheDocument();

    // o texto fixo do motor não leva o selo
    rerender(<CartaoLancamento id="c" aberto={{ linha: LINHA, ancora: celula(600, 500) }} />);
    expect(screen.queryByText("Gerada por IA · confira antes de decidir")).not.toBeInTheDocument();
  });

  it("says who justified the line, when and why, and keeps the category in the label", () => {
    const justificada: LinhaComparacao = {
      ...LINHA,
      decisao: {
        tipo: "justificada",
        texto: "Juros de dois dias de atraso, lançados como despesa financeira.",
        autor: "Eduardo Sichelero",
        em: "2026-09-30T13:12:00Z",
        rodada: 1,
      },
    };
    render(<CartaoLancamento id="c" aberto={{ linha: justificada, ancora: celula(600, 500) }} rodada={2} />);

    const cartao = screen.getByRole("tooltip");
    expect(cartao).toHaveTextContent("Lançamento · Valor diverge na mesma data · justificada");
    expect(cartao).toHaveTextContent("Justificada por Eduardo Sichelero em 30/09/2026 10:12");
    expect(cartao).toHaveTextContent("Juros de dois dias de atraso, lançados como despesa financeira.");
  });

  it("warns when a line checked in an earlier round still diverges", () => {
    const conferida: LinhaComparacao = {
      ...LINHA,
      decisao: { tipo: "conferida", texto: null, autor: "Eduardo Sichelero", em: "2026-09-24T18:40:00Z", rodada: 1 },
    };
    const { rerender } = render(
      <CartaoLancamento id="c" aberto={{ linha: conferida, ancora: celula(600, 500) }} rodada={2} />,
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Conferida na rodada 1, continua divergindo depois da nova versão",
    );

    // conferida nesta mesma rodada: não há o que avisar
    rerender(<CartaoLancamento id="c" aberto={{ linha: conferida, ancora: celula(600, 500) }} rodada={1} />);
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("continua divergindo");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { AcheAsDiferencas, PONTE, formatarTempo, textoDoResultado } from "./ache-as-diferencas";
import { porExtenso } from "./categorias";
import type { LinhaExtrato } from "./comparacao";

// um agosto menor que o da landing: três linhas no banco e duas no sistema, para os números do
// texto virem dos dados, não do agosto de verdade
const BATE: LinhaExtrato = {
  data: "03/08",
  desc: "Recebimento cliente Alfa Comércio",
  valorBanco: "R$ 3.250,00",
  valorSistema: "R$ 3.250,00",
  status: "match_exato",
  explicacao: null,
};
const VALOR: LinhaExtrato = {
  data: "04/08",
  desc: "Pagamento fornecedor #1082",
  valorBanco: "R$ 12.640,00",
  valorSistema: "R$ 12.604,00",
  status: "divergente_valor",
  explicacao: null,
};
const TARIFA: LinhaExtrato = {
  data: "06/08",
  desc: "Tarifa de manutenção da conta",
  valorBanco: "R$ 45,00",
  valorSistema: null,
  status: "tarifa_bancaria",
  explicacao: null,
};
const FATOS = { [VALOR.desc]: "R$ 36,00 a mais no banco", [TARIFA.desc]: "não está no sistema" };

const jogo = () => render(<AcheAsDiferencas banco={[BATE, VALOR, TARIFA]} sistema={[BATE, VALOR]} fatos={FATOS} />);
const listaBanco = () => screen.getByRole("list", { name: "Extrato do banco" });
const listaSistema = () => screen.getByRole("list", { name: "Sistema de gestão" });
const linha = (lista: HTMLElement, desc: string) =>
  within(lista)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(desc))!;
const marcar = (desc: string) => fireEvent.click(within(listaBanco()).getByRole("button", { name: new RegExp(desc.replace(/[#+]/g, "\\$&")) }));
const revelar = () => fireEvent.click(screen.getByRole("button", { name: "Ver o que passou" }));
const regiaoViva = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-live="polite"]')!;

afterEach(() => {
  vi.useRealTimers();
});

describe("formatarTempo", () => {
  it("formats the clock as m:ss", () => {
    expect(formatarTempo(0)).toBe("0:00");
    expect(formatarTempo(42)).toBe("0:42");
    expect(formatarTempo(65)).toBe("1:05");
    expect(formatarTempo(600)).toBe("10:00");
  });
});

describe("textoDoResultado", () => {
  it("words the result with the counts, or says nothing was marked", () => {
    expect(textoDoResultado(2, 4, 3, "0:42")).toBe("Você achou 2 de 4, em 0:42.");
    expect(textoDoResultado(0, 4, 0, "0:12")).toBe("Você não marcou nenhuma: passaram as 4.");
  });
});

describe("porExtenso", () => {
  it("spells counts out in either gender", () => {
    expect(porExtenso(5, "m")).toBe("Cinco");
    expect(porExtenso(1, "m")).toBe("Um");
    expect(porExtenso(1, "f")).toBe("Uma");
    expect(porExtenso(2, "m")).toBe("Dois");
    expect(porExtenso(12, "f")).toBe("12");
  });
});

describe("AcheAsDiferencas", () => {
  it("makes each bank line a toggle named by date, description and value, and leaves the system as text", () => {
    jogo();
    const botoes = within(listaBanco()).getAllByRole("button");
    expect(botoes.map((botao) => botao.getAttribute("aria-label"))).toEqual([
      "03/08, Recebimento cliente Alfa Comércio, R$ 3.250,00",
      "04/08, Pagamento fornecedor #1082, R$ 12.640,00",
      "06/08, Tarifa de manutenção da conta, R$ 45,00",
    ]);
    for (const botao of botoes) expect(botao).toHaveAttribute("aria-pressed", "false");
    expect(within(listaSistema()).queryAllByRole("button")).toHaveLength(0);
    expect(within(listaSistema()).getAllByRole("listitem")).toHaveLength(2);
  });

  it("says how many lines there are, for mouse and for touch", () => {
    jogo();
    expect(screen.getByText("Três lançamentos de agosto. Marque os do banco que não batem com o sistema.")).toBeInTheDocument();
    expect(screen.getByText("Três lançamentos de agosto. Toque nos do banco que não batem com o sistema.")).toBeInTheDocument();
  });

  it("toggles a line on and off", () => {
    jogo();
    const botao = within(listaBanco()).getByRole("button", { name: /Pagamento fornecedor #1082/ });
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-pressed", "false");
  });

  it("starts the clock on the first mark and stops it on the reveal", () => {
    vi.useFakeTimers();
    jogo();
    const relogio = () => document.querySelector(".ache-relogio")!.textContent;
    expect(relogio()).toContain("0:00");
    act(() => vi.advanceTimersByTime(5000));
    expect(relogio()).toContain("0:00");
    marcar(VALOR.desc);
    act(() => vi.advanceTimersByTime(42_000));
    expect(relogio()).toContain("0:42");
    revelar();
    act(() => vi.advanceTimersByTime(10_000));
    expect(relogio()).toContain("0:42");
  });

  it("marks what was found, what slipped and what was marked for nothing", () => {
    jogo();
    marcar(BATE.desc);
    marcar(VALOR.desc);
    revelar();
    expect(linha(listaBanco(), VALOR.desc)).toHaveAttribute("data-estado", "achou");
    expect(linha(listaBanco(), VALOR.desc)).toHaveTextContent("Você achou. Valor diverge · R$ 36,00 a mais no banco");
    expect(linha(listaBanco(), TARIFA.desc)).toHaveAttribute("data-estado", "passou");
    expect(linha(listaBanco(), TARIFA.desc)).toHaveTextContent("Passou. Tarifa · não está no sistema");
    expect(linha(listaBanco(), BATE.desc)).toHaveAttribute("data-estado", "a-toa");
    expect(linha(listaBanco(), BATE.desc)).toHaveTextContent("Esta bate.");
  });

  it("lights the pair in the system", () => {
    jogo();
    marcar(BATE.desc);
    marcar(VALOR.desc);
    revelar();
    expect(linha(listaSistema(), VALOR.desc)).toHaveAttribute("data-estado", "achou");
    expect(linha(listaSistema(), BATE.desc)).not.toHaveAttribute("data-estado");
  });

  it("announces the result and the bridge once, in a live region", () => {
    const { container } = jogo();
    expect(regiaoViva(container)).toBeEmptyDOMElement();
    marcar(VALOR.desc);
    revelar();
    expect(regiaoViva(container)).toHaveTextContent("Você achou 1 de 2, em 0:00.");
    expect(regiaoViva(container)).toHaveTextContent(PONTE);
  });

  it("says nothing was marked even after marking and unmarking", () => {
    const { container } = jogo();
    marcar(VALOR.desc);
    marcar(VALOR.desc);
    revelar();
    expect(regiaoViva(container)).toHaveTextContent("Você não marcou nenhuma: passaram as 2.");
  });

  it("turns the lines into text after the reveal and offers the way on", () => {
    jogo();
    revelar();
    expect(within(listaBanco()).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Ver o que passou" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver como funciona" })).toHaveAttribute("href", "#como");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tentar de novo" }));
  });

  it("starts over from scratch", () => {
    const { container } = jogo();
    marcar(VALOR.desc);
    revelar();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    const botoes = within(listaBanco()).getAllByRole("button");
    expect(botoes).toHaveLength(3);
    for (const botao of botoes) expect(botao).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".ache-relogio")).toHaveTextContent("0:00");
    expect(container.querySelector(".ache-nota")).toBeNull();
    expect(regiaoViva(container)).toBeEmptyDOMElement();
    expect(document.activeElement).toBe(botoes[0]);
  });

  it("stops the clock when it leaves the page", () => {
    vi.useFakeTimers();
    const { unmount } = jogo();
    marcar(VALOR.desc);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

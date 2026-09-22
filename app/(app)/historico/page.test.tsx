import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HISTORICO_MESES } from "@/lib/mock-data";
import HistoricoPage from "./page";

describe("HistoricoPage", () => {
  it("headlines the current competência taxa de match", () => {
    render(<HistoricoPage />);
    expect(screen.getByText("Histórico de conciliações")).toBeInTheDocument();
    expect(screen.getByText("96,3% em setembro")).toBeInTheDocument();
  });

  it("derives the improvement from the data instead of hard-coding it", () => {
    render(<HistoricoPage />);
    // 96,3 em setembro contra 91,8 em abril = 4,5 pontos, não os 6,4 do export
    expect(screen.getByText(/Subiu 4,5 pontos desde abril/)).toBeInTheDocument();
  });

  it("draws one bar per competência, oldest first", () => {
    const { container } = render(<HistoricoPage />);
    const colunas = container.querySelectorAll(".hist-barra-coluna");
    expect(colunas).toHaveLength(HISTORICO_MESES.length);
    expect(colunas[0].textContent).toContain("Abr");
    expect(colunas[colunas.length - 1].textContent).toContain("Set");
  });

  it("gives a taller bar to a higher match rate", () => {
    const { container } = render(<HistoricoPage />);
    const barras = [...container.querySelectorAll(".hist-barra")] as HTMLElement[];
    const abril = Number.parseInt(barras[0].style.height, 10);
    const agosto = Number.parseInt(barras[4].style.height, 10);
    // abril 91,8% contra agosto 97,3%
    expect(agosto).toBeGreaterThan(abril);
  });

  it("lists every competência in the month-by-month table", () => {
    render(<HistoricoPage />);
    expect(screen.getByText("Setembro 2026")).toBeInTheDocument();
    expect(screen.getByText("Abril 2026")).toBeInTheDocument();
    expect(screen.getByText("4.218")).toBeInTheDocument();
  });

  it("marks the competências fechadas com ressalva", () => {
    render(<HistoricoPage />);
    const comRessalva = HISTORICO_MESES.filter((mes) => mes.fechadoComRessalva).length;
    expect(screen.getAllByText("Fechado com ressalva")).toHaveLength(comRessalva);
  });

  it("totals the ajuste líquido across the six competências", () => {
    render(<HistoricoPage />);
    const total = HISTORICO_MESES.reduce((soma, mes) => soma + mes.ajusteLiquido, 0);
    expect(screen.getByText(new RegExp(total.toLocaleString("pt-BR")))).toBeInTheDocument();
  });
});

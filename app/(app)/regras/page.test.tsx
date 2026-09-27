import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Regra } from "@/lib/mock-data";
import RegrasPage from "./page";

const listarRegras = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  listarRegras: () => listarRegras(),
  tomDaRegra: (marca: string) =>
    marca === "Aprendida" ? "ok" : marca === "Sugerida" ? "atencao" : "neutro",
}));

const ativa: Regra = {
  id: 0,
  titulo: "Juros de atraso da Aço Norte Bobinas",
  marca: "Aprendida",
  texto: "Classificar a diferença como despesa financeira e casar automaticamente.",
  rodape: "Criada em 12/08/2026 por Financeiro · aplicada 3 vezes",
  impacto: "3 casos por mês",
};

const sugerida: Regra = {
  id: 2,
  titulo: "Estornos de maquininha com dois dias de folga",
  marca: "Sugerida",
  texto: "Uma janela de dois dias para essa descrição resolveria dezoito dos vinte e dois casos.",
  rodape: "Padrão detectado em julho, agosto e setembro",
  impacto: "resolve 5 de 6",
};

describe("RegrasPage", () => {
  beforeEach(() => {
    listarRegras.mockReset();
  });

  it("splits the rules into ativas and sugeridas with the counts under the title", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa], sugeridas: [sugerida] });
    render(<RegrasPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Regras" })).toBeInTheDocument();
    expect(screen.getByText("1 ativa · 1 sugerida")).toBeInTheDocument();
    expect(screen.getByText(ativa.titulo)).toBeInTheDocument();
    expect(screen.getByText(sugerida.titulo)).toBeInTheDocument();
    expect(screen.getByText("Aprendida")).toBeInTheDocument();
    expect(screen.getByText("resolve 5 de 6")).toBeInTheDocument();
  });

  it("colours the badge by where the rule came from", () => {
    listarRegras.mockReturnValue({ ativas: [ativa], sugeridas: [] });
    render(<RegrasPage />);
    // Aprendida ja trabalha por voce: verde
    expect(screen.getByText("Aprendida")).toHaveClass("selo-ok");
  });

  it("pluralises the counts", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa, { ...ativa, id: 1 }], sugeridas: [] });
    render(<RegrasPage />);
    expect(await screen.findByText("2 ativas · 0 sugeridas")).toBeInTheDocument();
  });

  it("says the rules are a demonstration, and does not pretend to save them", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa], sugeridas: [sugerida] });
    render(<RegrasPage />);

    const aviso = await screen.findByRole("note");
    expect(aviso).toHaveTextContent("As regras ainda não estão no ar.");
    // o backend não guarda regra: os dois botões ficam desligados e dizem por quê
    for (const nome of ["Desativar", "Criar regra"]) {
      const botao = screen.getByRole("button", { name: nome });
      expect(botao).toBeDisabled();
      expect(botao).toHaveAttribute("aria-describedby", aviso.id);
    }
  });

  it("explains the empty state on each list instead of showing a bare heading", async () => {
    listarRegras.mockReturnValue({ ativas: [], sugeridas: [] });
    render(<RegrasPage />);

    expect(await screen.findByText(/Nenhuma regra ativa/)).toBeInTheDocument();
    expect(screen.getByText(/Todas as sugestões já viraram regra/)).toBeInTheDocument();
  });
});

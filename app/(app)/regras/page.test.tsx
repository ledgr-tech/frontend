import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Regra } from "@/lib/mock-data";
import RegrasPage from "./page";

const listarRegras = vi.fn();
const ativarRegra = vi.fn();
const desativarRegra = vi.fn();
vi.mock("@/lib/mock-data", () => ({
  listarRegras: () => listarRegras(),
  ativarRegra: (id: number) => ativarRegra(id),
  desativarRegra: (id: number) => desativarRegra(id),
}));

const ativa: Regra = {
  id: 0,
  titulo: "Juros de atraso da Aço Norte Bobinas",
  nivel: "medio",
  marca: "Aprendida",
  texto: "Classificar a diferença como despesa financeira e casar automaticamente.",
  rodape: "Criada em 12/08/2026 por Financeiro · aplicada 3 vezes",
  impacto: "3 casos por mês",
};

const sugerida: Regra = {
  id: 2,
  titulo: "Estornos de maquininha com dois dias de folga",
  nivel: "medio",
  marca: "Sugerida",
  texto: "Uma janela de dois dias para essa descrição resolveria dezoito dos vinte e dois casos.",
  rodape: "Padrão detectado em julho, agosto e setembro",
  impacto: "resolve 5 de 6",
};

describe("RegrasPage", () => {
  beforeEach(() => {
    listarRegras.mockReset();
    ativarRegra.mockReset();
    desativarRegra.mockReset();
  });

  it("splits the rules into ativas and sugeridas with the counts in the kicker", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa], sugeridas: [sugerida] });
    render(<RegrasPage />);

    expect(await screen.findByText("Suas regras")).toBeInTheDocument();
    expect(screen.getByText("1 ativa · 1 sugerida")).toBeInTheDocument();
    expect(screen.getByText(ativa.titulo)).toBeInTheDocument();
    expect(screen.getByText(sugerida.titulo)).toBeInTheDocument();
    expect(screen.getByText("Aprendida")).toBeInTheDocument();
    expect(screen.getByText("resolve 5 de 6")).toBeInTheDocument();
  });

  it("pluralises the kicker counts", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa, { ...ativa, id: 1 }], sugeridas: [] });
    render(<RegrasPage />);
    expect(await screen.findByText("2 ativas · 0 sugeridas")).toBeInTheDocument();
  });

  it("deactivates a rule and re-reads the lists", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa], sugeridas: [sugerida] });
    const user = userEvent.setup();
    render(<RegrasPage />);

    await user.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(desativarRegra).toHaveBeenCalledWith(0);
    // uma leitura no efeito inicial e outra depois da mudança
    expect(listarRegras).toHaveBeenCalledTimes(2);
  });

  it("promotes a suggestion into a rule", async () => {
    listarRegras.mockReturnValue({ ativas: [ativa], sugeridas: [sugerida] });
    const user = userEvent.setup();
    render(<RegrasPage />);

    await user.click(await screen.findByRole("button", { name: "Criar regra" }));

    expect(ativarRegra).toHaveBeenCalledWith(2);
  });

  it("explains the empty state on each list instead of showing a bare heading", async () => {
    listarRegras.mockReturnValue({ ativas: [], sugeridas: [] });
    render(<RegrasPage />);

    expect(await screen.findByText(/Nenhuma regra ativa/)).toBeInTheDocument();
    expect(screen.getByText(/Todas as sugestões já viraram regra/)).toBeInTheDocument();
  });
});

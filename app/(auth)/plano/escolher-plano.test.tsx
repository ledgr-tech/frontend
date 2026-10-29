import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EscolherPlano } from "./escolher-plano";

const escolherPlano = vi.fn();
vi.mock("../acoes", () => ({ escolherPlano: (p: string) => escolherPlano(p) }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const medidor = () => screen.getByRole("slider", { name: /lançamentos por mês/ });
const indicado = () => screen.getByRole("region", { name: /O seu plano é o|Vamos combinar/ });
// os passos do medidor (escolher-plano.tsx): 0=20 … 3=100, 5=180, 6=200, 9=350, 10=500, 15=6000
const arrastarPara = (passo: number) => fireEvent.change(medidor(), { target: { value: String(passo) } });

describe("EscolherPlano", () => {
  beforeEach(() => {
    escolherPlano.mockReset();
    push.mockReset();
  });

  it("pergunta o volume e já indica um plano, com o teste sem cartão", () => {
    render(<EscolherPlano />);
    expect(screen.getByRole("heading", { level: 1, name: "Quantos lançamentos você concilia por mês?" })).toBeInTheDocument();
    expect(screen.getByText(/14 dias, sem cartão/)).toBeInTheDocument();
    // começa em 180, o Padrão
    expect(medidor()).toHaveAttribute("aria-valuetext", "180 lançamentos por mês");
    expect(within(indicado()).getByRole("heading", { name: "O seu plano é o Padrão." })).toBeInTheDocument();
    expect(within(indicado()).getByText("R$ 79,90")).toBeInTheDocument();
    expect(within(indicado()).getByText("Para escritórios")).toBeInTheDocument();
  });

  it("o plano indicado segue o volume, e acima de 350 é combinado com a equipe", () => {
    render(<EscolherPlano />);
    arrastarPara(3);
    expect(within(indicado()).getByRole("heading", { name: "O seu plano é o Essencial." })).toBeInTheDocument();
    arrastarPara(9);
    expect(within(indicado()).getByRole("heading", { name: "O seu plano é o Avançado." })).toBeInTheDocument();
    expect(within(indicado()).getByText("Assistente de IA no Ledgr")).toBeInTheDocument();
    arrastarPara(10);
    expect(within(indicado()).getByRole("heading", { name: "Vamos combinar juntos." })).toBeInTheDocument();
    const contato = within(indicado()).getByRole("link", { name: "Fale com a gente" });
    expect(contato.getAttribute("href")).toMatch(/^mailto:ledgrtech@gmail\.com\?subject=/);
    arrastarPara(15);
    expect(medidor()).toHaveAttribute("aria-valuetext", "6.000 ou mais lançamentos por mês");
  });

  it('"ou escolha outro" leva o medidor até o plano', async () => {
    const user = userEvent.setup();
    render(<EscolherPlano />);
    await user.click(screen.getByRole("button", { name: "Avançado" }));
    expect(within(indicado()).getByRole("heading", { name: "O seu plano é o Avançado." })).toBeInTheDocument();
    expect(medidor()).toHaveAttribute("aria-valuetext", "350 lançamentos por mês");
    await user.click(screen.getByRole("button", { name: "Volume" }));
    expect(within(indicado()).getByRole("heading", { name: "Vamos combinar juntos." })).toBeInTheDocument();
  });

  it("começar abre a Visão geral com o plano indicado", async () => {
    escolherPlano.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<EscolherPlano />);
    await user.click(screen.getByRole("button", { name: "Começar com o Padrão" }));
    expect(escolherPlano).toHaveBeenCalledWith("padrao");
    expect(push).toHaveBeenCalledWith("/visao-geral");
  });

  it("se falhar, mostra o motivo e libera o botão", async () => {
    escolherPlano.mockResolvedValue({ ok: false, erro: "Ainda não disponível: o servidor do Ledgr ainda não tem esta função." });
    const user = userEvent.setup();
    render(<EscolherPlano />);
    arrastarPara(3);
    await user.click(screen.getByRole("button", { name: "Começar com o Essencial" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ainda não disponível");
    expect(screen.getByRole("button", { name: "Começar com o Essencial" })).toBeEnabled();
  });

  it("com o teste acabado, assinar fala com a equipe e não começa outro teste", () => {
    render(<EscolherPlano encerrado />);
    expect(screen.getByRole("heading", { level: 1, name: "Seu teste acabou. Escolha um plano." })).toBeInTheDocument();
    const assinar = screen.getByRole("link", { name: "Assinar o Padrão" });
    expect(assinar.getAttribute("href")).toMatch(/^mailto:ledgrtech@gmail\.com\?subject=/);
    expect(decodeURIComponent(assinar.getAttribute("href")!)).toContain("Assinar o Padrão");
    expect(screen.queryByRole("button", { name: /Assinar|Começar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/14 dias/)).not.toBeInTheDocument();
    expect(escolherPlano).not.toHaveBeenCalled();
  });
});

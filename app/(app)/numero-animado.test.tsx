import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { NumeroAnimado } from "./numero-animado";

function fingirMenosMovimento(ativo: boolean) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("reduce") && ativo,
    media: consulta,
  }));
}

const inteiro = (v: number) => String(Math.round(v));

describe("NumeroAnimado", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra o valor de cara, sem animar a montagem", () => {
    fingirMenosMovimento(false);
    render(<NumeroAnimado valor={12640} formatar={inteiro} />);
    // se animasse ao montar, aqui estaria em 0 ou num valor intermediário
    expect(screen.getByText("12640")).toBeInTheDocument();
  });

  it("interpola entre os valores e fecha no destino", async () => {
    fingirMenosMovimento(false);
    // o relógio é do quadro, não do teste: controlando o rAF dá para inspecionar
    // um passo intermediário em vez de esperar tempo real passar
    const quadros: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      quadros.push(cb);
      return quadros.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const inicio = performance.now();

    const { rerender } = render(<NumeroAnimado valor={12604} formatar={inteiro} />);
    rerender(<NumeroAnimado valor={12640} formatar={inteiro} />);

    // meio da animação: já saiu da origem e ainda não chegou
    await act(async () => {
      quadros.shift()?.(inicio + 300);
    });
    const meio = Number(screen.getByText(/^126/).textContent);
    expect(meio).toBeGreaterThan(12604);
    expect(meio).toBeLessThan(12640);

    // passado o tempo total, fecha exatamente no destino
    await act(async () => {
      quadros.shift()?.(inicio + 5000);
    });
    expect(screen.getByText("12640")).toBeInTheDocument();
  });

  it("salta direto para o novo valor com menos movimento pedido", () => {
    fingirMenosMovimento(true);
    const { rerender } = render(<NumeroAnimado valor={100} formatar={inteiro} />);
    rerender(<NumeroAnimado valor={900} formatar={inteiro} />);

    // sem quadro intermediário: já está no destino
    expect(screen.getByText("900")).toBeInTheDocument();
  });

  it("usa o formatador em cada quadro, não só no fim", async () => {
    fingirMenosMovimento(true);
    const formatar = vi.fn((v: number) => `R$ ${Math.round(v)}`);
    const { rerender } = render(<NumeroAnimado valor={10} formatar={formatar} />);
    rerender(<NumeroAnimado valor={20} formatar={formatar} />);

    await waitFor(() => expect(screen.getByText("R$ 20")).toBeInTheDocument());
    expect(formatar).toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESCOLHER_PLANO, PASSO_INICIAL, passoDoPlano } from "@/lib/medidor-de-planos";
import { ReguaQueMede } from "./regua-que-mede";

// "Ver o meu plano" (para-quem.tsx → meu-plano.tsx) avisa a régua com ESCOLHER_PLANO; ela corre até o teto
// do plano daquele perfil, com o traço e o número andando juntos, e não pula.
describe("ReguaQueMede: a corrida até o plano de um perfil", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const traco = () => screen.getByRole("slider") as HTMLInputElement;
  const passo = () => Number(traco().value);
  const numero = () => Number((document.querySelector(".regua-mede-valor output")?.textContent ?? "").replace(/\D/g, ""));
  const escolher = (plano: string) =>
    act(() => {
      window.dispatchEvent(new CustomEvent(ESCOLHER_PLANO, { detail: plano }));
    });
  const passar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("passa pelos valores do meio e chega ao teto do plano", () => {
    render(<ReguaQueMede />);
    expect(passo()).toBe(PASSO_INICIAL);
    expect(numero()).toBe(180);

    escolher("avancado");
    passar(300);
    // no meio do caminho: nem no começo, nem no fim, o traço e o número juntos
    expect(passo()).toBeGreaterThan(PASSO_INICIAL);
    expect(passo()).toBeLessThan(passoDoPlano("avancado"));
    expect(numero()).toBeGreaterThan(180);
    expect(numero()).toBeLessThan(350);

    passar(1000);
    expect(passo()).toBe(passoDoPlano("avancado"));
    expect(numero()).toBe(350);
    expect(screen.getByRole("heading", { name: /Avançado/ })).toBeTruthy();
  });

  it("também corre para baixo, até o Essencial", () => {
    render(<ReguaQueMede />);
    escolher("essencial");
    passar(300);
    expect(numero()).toBeLessThan(180);
    expect(numero()).toBeGreaterThan(100);
    passar(1000);
    expect(numero()).toBe(100);
    expect(screen.getByRole("heading", { name: /Essencial/ })).toBeTruthy();
  });

  it("com menos movimento pedido, vai direto ao valor", () => {
    vi.stubGlobal("matchMedia", (consulta: string) => ({ matches: consulta.includes("reduce"), media: consulta }));
    render(<ReguaQueMede />);
    escolher("avancado");
    expect(passo()).toBe(passoDoPlano("avancado"));
    expect(numero()).toBe(350);
  });

  it("quem mexe na régua no meio da corrida assume o controle", () => {
    render(<ReguaQueMede />);
    escolher("avancado");
    passar(300);
    fireEvent.change(traco(), { target: { value: "2" } });
    expect(passo()).toBe(2);
    passar(1500);
    // a corrida não volta a puxar a régua para o plano
    expect(passo()).toBe(2);
  });

  it("um perfil que já está no plano não anima nada", () => {
    render(<ReguaQueMede />);
    escolher("avancado");
    passar(1200);
    escolher("avancado");
    passar(16);
    expect(passo()).toBe(passoDoPlano("avancado"));
  });
});

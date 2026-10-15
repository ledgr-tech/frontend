import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ProvedorDaConta, usePreferencias } from "./conta";

const salvarPreferencias = vi.fn<(p: unknown) => Promise<boolean>>(async () => true);
vi.mock("../(auth)/acoes", () => ({ salvarPreferencias: (p: unknown) => salvarPreferencias(p) }));

function Sonda() {
  const p = usePreferencias();
  return (
    <div>
      <span>{p.carregado ? "carregado" : "carregando"}</span>
      <span>{p.tutorialDispensado("extratos") ? "extratos dispensado" : "extratos ativo"}</span>
      <span>{p.roteiroDispensado ? "roteiro dispensado" : "roteiro ativo"}</span>
      <button onClick={() => p.dispensarTutorial("extratos")}>dispensar tutorial</button>
      <button onClick={() => p.dispensarRoteiro()}>dispensar roteiro</button>
    </div>
  );
}

describe("ProvedorDaConta", () => {
  beforeEach(() => {
    window.localStorage.clear();
    salvarPreferencias.mockClear();
  });

  it("junta o que veio da conta com o navegador", async () => {
    window.localStorage.setItem(
      "ledgr:preferencias",
      JSON.stringify({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false }),
    );
    render(
      <ProvedorDaConta preferencias={{ tutoriaisDispensados: [], roteiroDispensado: true }}>
        <Sonda />
      </ProvedorDaConta>,
    );
    await waitFor(() => expect(screen.getByText("carregado")).toBeInTheDocument());
    expect(screen.getByText("extratos dispensado")).toBeInTheDocument();
    expect(screen.getByText("roteiro dispensado")).toBeInTheDocument();
  });

  it("dispensar guarda no navegador e manda para a conta, uma vez", async () => {
    render(
      <ProvedorDaConta preferencias={null}>
        <Sonda />
      </ProvedorDaConta>,
    );
    await waitFor(() => expect(screen.getByText("carregado")).toBeInTheDocument());
    await act(async () => screen.getByText("dispensar tutorial").click());
    expect(screen.getByText("extratos dispensado")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("ledgr:preferencias")!).tutoriaisDispensados).toEqual(["extratos"]);
    expect(salvarPreferencias).toHaveBeenCalledTimes(1);
    expect(salvarPreferencias).toHaveBeenCalledWith({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false });

    await act(async () => screen.getByText("dispensar roteiro").click());
    expect(screen.getByText("roteiro dispensado")).toBeInTheDocument();
    expect(salvarPreferencias).toHaveBeenLastCalledWith({ tutoriaisDispensados: ["extratos"], roteiroDispensado: true });
  });
});

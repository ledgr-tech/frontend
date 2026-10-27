import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvedorDaConta } from "../conta";
import { TutorialDaRota } from "./tutorial-da-rota";

let caminho = "/extratos";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));
vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

describe("TutorialDaRota", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("abre o tutorial da tela do endereço", async () => {
    caminho = "/extratos";
    render(
      <ProvedorDaConta preferencias={null}>
        <div data-tutorial="filtros" />
        <div data-tutorial="arquivos" />
        <div data-tutorial="painel" />
        <TutorialDaRota atraso={0} espera={0} />
      </ProvedorDaConta>,
    );
    expect(await screen.findByText("Extratos · 1 de 3")).toBeInTheDocument();
  });

  it("não abre nada onde não há tutorial", async () => {
    caminho = "/assinatura";
    render(
      <ProvedorDaConta preferencias={null}>
        <TutorialDaRota atraso={0} espera={0} />
      </ProvedorDaConta>,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoasVindas } from "./boas-vindas";
import { ProvedorDaConta } from "../conta";
import { ABRIR_TUTORIAL } from "@/lib/eventos";

vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const EMAIL = "ana@example.com";

function montar(props: { nome?: string; demonstracao?: boolean } = {}) {
  return render(
    <ProvedorDaConta email={EMAIL} nome={props.nome ?? "Ana Souza"} preferencias={null}>
      <BoasVindas demonstracao={props.demonstracao} />
    </ProvedorDaConta>,
  );
}

describe("BoasVindas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("aparece na primeira entrada, com o primeiro nome e os três passos", async () => {
    montar();
    expect(await screen.findByText("Boas-vindas, Ana")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("sem nome, diz Boas-vindas ao Ledgr", async () => {
    montar({ nome: "" });
    expect(await screen.findByText("Boas-vindas ao Ledgr")).toBeInTheDocument();
  });

  it("Começar fecha, marca como vista e abre o tutorial uma vez", async () => {
    const abriu = vi.fn();
    window.addEventListener(ABRIR_TUTORIAL, abriu);
    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(await screen.findByRole("button", { name: "Começar" }));
    await waitFor(() => expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument());
    expect(abriu).toHaveBeenCalledTimes(1);
    window.removeEventListener(ABRIR_TUTORIAL, abriu);
    unmount();
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument();
  });

  it("Agora não fecha e não volta ao remontar, sem abrir o tutorial", async () => {
    const abriu = vi.fn();
    window.addEventListener(ABRIR_TUTORIAL, abriu);
    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(await screen.findByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument());
    expect(abriu).not.toHaveBeenCalled();
    // a janela e o tutorial da Visão geral ficam vistos juntos, de vez (não só nesta sessão)
    const guardadas = JSON.parse(window.localStorage.getItem(`ledgr:preferencias:${EMAIL.toLowerCase()}`)!);
    expect(guardadas).toMatchObject({ tutoriaisDispensados: ["visao-geral"], boasVindasVista: true });
    window.removeEventListener(ABRIR_TUTORIAL, abriu);
    unmount();
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument();
  });

  it("Esc fecha e conta como vista", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await screen.findByText("Boas-vindas, Ana");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument());
    unmount();
    montar();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument();
  });

  it("quem já dispensou o roteiro não a vê", async () => {
    render(
      <ProvedorDaConta email={EMAIL} nome="Ana" preferencias={{ tutoriaisDispensados: [], roteiroDispensado: true }}>
        <BoasVindas />
      </ProvedorDaConta>,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument();
  });

  it("na conta de demonstração não aparece", async () => {
    montar({ demonstracao: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Boas-vindas, Ana")).not.toBeInTheDocument();
  });
});

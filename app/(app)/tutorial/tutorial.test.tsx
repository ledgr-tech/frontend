import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tutorial } from "./tutorial";
import { ProvedorDaConta } from "../conta";
import { abrirTutorial } from "@/lib/eventos";

vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const esperar = () => new Promise((r) => setTimeout(r, 20));

function montar(conteudo = <div data-tutorial="filtros">filtros</div>) {
  return render(
    <ProvedorDaConta preferencias={null}>
      {conteudo}
      <button>fora</button>
      <Tutorial tela="extratos" atraso={0} />
    </ProvedorDaConta>,
  );
}

describe("Tutorial", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("abre sozinho na primeira visita e destaca o alvo do passo", async () => {
    montar();
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
    expect(screen.getByText("Extratos · 1 de 3")).toBeInTheDocument();
    expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo");
  });

  it("anda pelos passos e o passo sem alvo aparece sem destaque", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("dialog", { name: "Todos os arquivos que você enviou." })).toBeInTheDocument();
    expect(screen.getByText("filtros")).not.toHaveAttribute("data-tutorial-ativo");
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
  });

  it("no último passo, Entendi fecha", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    await user.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Esc fecha, devolve o foco e só volta numa próxima sessão", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    screen.getByRole("button", { name: "fora" }).focus();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "fora" })).toHaveFocus();
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
    unmount();

    // voltar à tela na mesma sessão (abrir uma linha e voltar) não reabre o cartão
    const segunda = montar();
    await esperar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    segunda.unmount();

    // numa sessão nova, sem a caixa marcada, ele volta
    window.sessionStorage.clear();
    montar();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("espera a tela carregar: abre quando o alvo aparece, já com o destaque", async () => {
    montar(<div id="vazio" />);
    await esperar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const alvo = document.createElement("div");
    alvo.setAttribute("data-tutorial", "filtros");
    document.getElementById("vazio")!.append(alvo);
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
    await waitFor(() => expect(alvo).toHaveAttribute("data-tutorial-ativo"));
  });

  it("pula o passo opcional cujo alvo não está na tela", async () => {
    render(
      <ProvedorDaConta preferencias={null}>
        <section data-tutorial="estado-do-mes">mês</section>
        <Tutorial tela="visao-geral" atraso={0} />
      </ProvedorDaConta>,
    );
    expect(await screen.findByRole("dialog", { name: "O mês em um número." })).toBeInTheDocument();
    expect(screen.getByText("Visão geral · 1 de 2")).toBeInTheDocument();
  });

  it("Esc fecha mesmo com o foco fora do cartão", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("dialog");
    screen.getByRole("button", { name: "fora" }).focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("com a caixa marcada, não volta mais", async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await screen.findByRole("dialog");
    await user.click(screen.getByLabelText("Não mostrar de novo"));
    await user.click(screen.getByRole("button", { name: "Pular" }));
    unmount();
    montar();
    await esperar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o botão ? reabre mesmo dispensado", async () => {
    window.localStorage.setItem(
      "ledgr:preferencias",
      JSON.stringify({ tutoriaisDispensados: ["extratos"], roteiroDispensado: false }),
    );
    montar();
    await esperar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => abrirTutorial());
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
  });

  it("desmontar com o tutorial aberto tira o destaque", async () => {
    const { unmount } = montar();
    await screen.findByRole("dialog");
    unmount();
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
  });
});

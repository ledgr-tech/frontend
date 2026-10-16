import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tutorial } from "./tutorial";
import { ProvedorDaConta } from "../conta";
import { abrirTutorial } from "@/lib/eventos";

vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const esperar = () => new Promise((r) => setTimeout(r, 20));

// a tela de Extratos sem o painel do arquivo: o terceiro passo do tutorial não tem alvo
const TELA = (
  <>
    <div data-tutorial="filtros">filtros</div>
    <div data-tutorial="arquivos">arquivos</div>
  </>
);

function montar(conteudo = TELA, espera?: number) {
  return render(
    <ProvedorDaConta preferencias={null}>
      {conteudo}
      <button>fora</button>
      <Tutorial tela="extratos" atraso={0} espera={espera} />
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
    expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo");
  });

  it("só entram os passos do que está na tela, e o destaque anda com eles", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("dialog");
    expect(screen.getByText("Extratos · 1 de 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("dialog", { name: "Todos os arquivos que você enviou." })).toBeInTheDocument();
    expect(screen.getByText("Extratos · 2 de 2")).toBeInTheDocument();
    expect(screen.getByText("filtros")).not.toHaveAttribute("data-tutorial-ativo");
    expect(screen.getByText("arquivos")).toHaveAttribute("data-tutorial-ativo");
  });

  it("no último passo, Entendi fecha", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("dialog");
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

  it("numa tela vazia não abre sozinho nem conta como visto: espera uma visita com conteúdo", async () => {
    const { unmount } = montar(<p>Nenhum extrato carregado ainda.</p>, 30);
    await new Promise((r) => setTimeout(r, 80));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    montar();
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
  });

  it("numa tela vazia, o ? mostra todos os passos, sem destaque", async () => {
    montar(<p>Nenhum extrato carregado ainda.</p>, 30);
    act(() => abrirTutorial());
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
    expect(screen.getByText("Extratos · 1 de 3")).toBeInTheDocument();
    expect(document.querySelector(".tutorial-destaque")).not.toBeVisible();
  });

  it("o recorte segue o alvo, com folga, e some ao fechar", async () => {
    const user = userEvent.setup();
    const alvo = document.createElement("div");
    alvo.setAttribute("data-tutorial", "filtros");
    alvo.getBoundingClientRect = () => ({ top: 100, left: 40, width: 300, height: 50 }) as DOMRect;
    const tela = document.createElement("div");
    tela.append(alvo);
    document.body.append(tela);
    montar(<span />);
    await screen.findByRole("dialog");
    const recorte = document.querySelector<HTMLElement>(".tutorial-destaque")!;
    expect(recorte).toBeVisible();
    expect(recorte.style).toMatchObject({ top: "92px", left: "32px", width: "316px", height: "66px" });
    await user.click(screen.getByRole("button", { name: "Pular" }));
    expect(document.querySelector(".tutorial-destaque")).toBeNull();
    tela.remove();
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

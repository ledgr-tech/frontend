import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tutorial } from "./tutorial";
import { ProvedorDaConta } from "../conta";
import { ProvedorDaColuna, ColunaAgora } from "../coluna/coluna";
import { abrirTutorial } from "@/lib/eventos";
import { caminhoDoFio } from "./fio";

vi.mock("next/navigation", () => ({ usePathname: () => "/extratos" }));
vi.mock("../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const esperar = () => new Promise((r) => setTimeout(r, 20));

// a tela de Extratos sem o painel do arquivo: o terceiro passo do tutorial não tem alvo
const TELA = (
  <>
    <div data-tutorial="filtros">filtros</div>
    <div data-tutorial="arquivos">arquivos</div>
  </>
);

function telas(largas: boolean) {
  window.matchMedia = ((q: string) => ({ matches: largas, media: q, addEventListener() {}, removeEventListener() {} })) as never;
}

function montar(conteudo = TELA, espera?: number, tela: "extratos" | "configuracoes" = "extratos") {
  return render(
    <ProvedorDaConta preferencias={null}>
      <ProvedorDaColuna>
        <ColunaAgora />
        {conteudo}
        <button>fora</button>
        <Tutorial tela={tela} atraso={0} espera={espera} />
      </ProvedorDaColuna>
    </ProvedorDaConta>,
  );
}

describe("Tutorial", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete document.documentElement.dataset.coluna;
    telas(true);
  });

  it("o cartão fica dentro da coluna Agora", async () => {
    montar();
    const cartao = await screen.findByRole("dialog", { name: "Separe o banco do sistema." });
    expect(screen.getByRole("complementary", { name: "O que fazer agora" })).toContainElement(cartao);
  });

  it("com a coluna recolhida, abre a coluna sem gravar e a recolhe de novo ao fechar", async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.coluna = "recolhida";
    const gravar = vi.spyOn(Storage.prototype, "setItem");
    montar();
    await screen.findByRole("dialog");
    expect(document.documentElement.dataset.coluna).not.toBe("recolhida");
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Pular" }));
    expect(document.documentElement.dataset.coluna).toBe("recolhida");
    expect(gravar.mock.calls.filter(([chave]) => chave === "ledgr_coluna")).toEqual([]);
    gravar.mockRestore();
  });

  it("nas telas menores, abrir o tutorial abre o painel e fechar o fecha", async () => {
    const user = userEvent.setup();
    telas(false);
    montar();
    const cartao = await screen.findByRole("dialog", { name: "Separe o banco do sistema." });
    expect(cartao.closest("aside")).toHaveAttribute("data-painel", "aberto");
    await waitFor(() => expect(cartao).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Pular" }));
    expect(document.querySelector("aside[data-painel]")).toBeNull();
  });

  it("na folha das telas menores, reserva embaixo a altura da folha, não o topo medido", async () => {
    telas(false);
    const largura = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const folha = this.hasAttribute("data-painel");
        return { top: folha ? 900 : 0, left: 0, width: folha ? 1000 : 10, height: 10, right: 0, bottom: 0 } as DOMRect;
      });
    const altura = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-painel") ? 300 : 0;
    });
    montar();
    await screen.findByRole("dialog", { name: "Separe o banco do sistema." });
    await waitFor(() => expect(screen.getByText("filtros").style.scrollMarginBottom).toBe("316px"));
    largura.mockRestore();
    altura.mockRestore();
  });

  it("em Configurações, que não tem coluna, o cartão fica fora do aside", async () => {
    montar(<div data-tutorial="tolerancia">x</div>, undefined, "configuracoes");
    const cartao = await screen.findByRole("dialog");
    expect(cartao.closest("aside")).toBeNull();
  });

  it("abre sozinho na primeira visita e destaca o alvo do passo", async () => {
    montar();
    expect(await screen.findByRole("dialog", { name: "Separe o banco do sistema." })).toBeInTheDocument();
    // o destaque entra num efeito depois do cartão: numa máquina lenta, um instante depois
    await waitFor(() => expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo"));
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
    await waitFor(() => expect(screen.getByText("arquivos")).toHaveAttribute("data-tutorial-ativo"));
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

  it("o véu tem um buraco no alvo, com folga e cantos redondos, e some ao fechar", async () => {
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
    await waitFor(() => expect(recorte).toBeVisible());
    // o alvo vai de (40, 100) a (340, 150); com a folga de 8, o buraco vai de (32, 92) a (348, 158),
    // e o traçado começa no fim do canto de cima à esquerda (raio 20)
    expect(recorte.style.clipPath).toContain(
      "M52 92h276a20 20 0 0 1 20 20v26a20 20 0 0 1 -20 20h-276a20 20 0 0 1 -20 -20v-26a20 20 0 0 1 20 -20Z",
    );
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
    await waitFor(() => expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo"));
    unmount();
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
  });
  describe("o fio em onda", () => {
    const caixa = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
    afterEach(() => document.querySelectorAll("body > div:has([data-tutorial])").forEach((tela) => tela.remove()));
    const fio = () => document.querySelector(".tutorial-fio");
    const d = () => document.querySelector(".tutorial-fio path")?.getAttribute("d");

    function alvos() {
      const tela = document.createElement("div");
      const filtros = document.createElement("div");
      filtros.setAttribute("data-tutorial", "filtros");
      filtros.getBoundingClientRect = () => caixa(40, 100, 300, 50);
      const arquivos = document.createElement("div");
      arquivos.setAttribute("data-tutorial", "arquivos");
      arquivos.getBoundingClientRect = () => caixa(40, 300, 200, 80);
      tela.append(filtros, arquivos);
      document.body.append(tela);
      return { tela, filtros };
    }

    it("liga o meio da borda esquerda do cartão ao alvo, muda de passo e some ao fechar", async () => {
      const user = userEvent.setup();
      const { tela } = alvos();
      montar(<span />);
      const cartao = await screen.findByRole("dialog");
      cartao.getBoundingClientRect = () => caixa(900, 100, 340, 400);
      // filtros: borda direita 340 + 8 de folga, meio da altura 125
      await waitFor(() => expect(d()).toBe(caminhoDoFio({ x: 900, y: 300 }, { x: 348, y: 125 })));
      expect(fio()).toHaveAttribute("aria-hidden", "true");
      await user.click(screen.getByRole("button", { name: "Próximo" }));
      // arquivos: borda direita 240 + 8, meio da altura 340
      await waitFor(() => expect(d()).toBe(caminhoDoFio({ x: 900, y: 300 }, { x: 248, y: 340 })));
      await user.click(screen.getByRole("button", { name: "Pular" }));
      expect(fio()).toBeNull();
      tela.remove();
    });

    it("nas telas menores, sai do meio da borda de cima do painel", async () => {
      telas(false);
      const { tela } = alvos();
      montar(<span />);
      const cartao = await screen.findByRole("dialog", { name: "Separe o banco do sistema." });
      cartao.closest(".coluna-agora")!.getBoundingClientRect = () => caixa(0, 500, 400, 300);
      await waitFor(() => expect(d()).toBe(caminhoDoFio({ x: 200, y: 500 }, { x: 190, y: 150 })));
      tela.remove();
    });

    it("com o alvo dentro da coluna, ao lado do cartão, não desenha o fio", async () => {
      const coluna = document.createElement("div");
      coluna.className = "coluna-agora";
      const filtros = document.createElement("div");
      filtros.setAttribute("data-tutorial", "filtros");
      filtros.getBoundingClientRect = () => caixa(40, 100, 300, 50);
      coluna.append(filtros);
      document.body.append(coluna);
      montar(<span />);
      const cartao = await screen.findByRole("dialog");
      cartao.getBoundingClientRect = () => caixa(900, 100, 340, 400);
      await esperar();
      expect(document.querySelector(".tutorial-fio path")).toBeNull();
      coluna.remove();
    });

    it("se o alvo some no meio do passo, o fio some sem erro", async () => {
      const { tela, filtros } = alvos();
      montar(<span />);
      const cartao = await screen.findByRole("dialog");
      cartao.getBoundingClientRect = () => caixa(900, 100, 340, 400);
      await waitFor(() => expect(d()).toBeTruthy());
      filtros.getBoundingClientRect = () => caixa(0, 0, 0, 0);
      await waitFor(() => expect(document.querySelector(".tutorial-fio path")).toBeNull());
      tela.remove();
    });

    it("sem alvo na tela, não desenha nenhum traço", async () => {
      montar(<span />);
      act(() => abrirTutorial());
      await screen.findByRole("dialog", { name: "Separe o banco do sistema." });
      await esperar();
      expect(document.querySelector(".tutorial-fio path")).toBeNull();
    });
  });
});

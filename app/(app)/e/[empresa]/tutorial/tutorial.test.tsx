import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cartaoVaiParaEsquerda, Tutorial } from "./tutorial";
import { ProvedorDaConta } from "../conta";
import { abrirTutorial } from "@/lib/eventos";
import { TUTORIAIS } from "./roteiros";

vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: vi.fn(async () => true) }));

const esperar = () => new Promise((r) => setTimeout(r, 20));
const mascoteAtras = () => document.querySelector(".tutorial-mascote-atras")?.getAttribute("src");

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
    montar(
      <div
        data-tutorial="filtros"
        ref={(alvo) => {
          if (alvo) {
            alvo.getBoundingClientRect = () => ({ top: 100, left: 40, width: 300, height: 50 }) as DOMRect;
          }
        }}
      />,
    );
    await screen.findByRole("dialog");
    const recorte = document.querySelector<HTMLElement>(".tutorial-destaque")!;
    await waitFor(() => expect(recorte).toBeVisible());
    const caminho = recorte.style.clipPath;
    expect(caminho).toMatch(/^path\(evenodd,\s*"/);
    const buraco = caminho.split(/[Zz]\s*(?=M)/)[1] ?? "";
    // Com folga de 8 e raio de 20, o buraco vai de (32, 92) a (348, 158).
    expect(buraco).toMatch(/^M\s*52\s+92\s*h/);
    const lados = [...buraco.matchAll(/([hv])\s*(-?\d+(?:\.\d+)?)/g)];
    expect(lados.map(([, eixo, medida]) => [eixo, Number(medida)])).toEqual([
      ["h", 276], ["v", 26], ["h", -276], ["v", -26],
    ]);
    const raios = [...buraco.matchAll(/a\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g)];
    expect(raios.map(([, rx, ry]) => [Number(rx), Number(ry)])).toEqual([
      [20, 20], [20, 20], [20, 20], [20, 20],
    ]);
    await user.click(screen.getByRole("button", { name: "Pular" }));
    expect(document.querySelector(".tutorial-destaque")).toBeNull();
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

  it("cada passo traz o seu mascote, atrás do cartão e fora dele", async () => {
    const user = userEvent.setup();
    montar();
    const cartao = await screen.findByRole("dialog");
    expect(cartao.querySelector("img")).toBeNull();
    expect(mascoteAtras()).toContain("mascote-dupla");
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(mascoteAtras()).toContain("mascote-arquivo");
  });

  it("o passo sem mascote próprio fica com o da tela", async () => {
    const [primeiro] = TUTORIAIS.extratos.passos;
    const { mascote } = primeiro;
    delete primeiro.mascote;
    try {
      montar();
      await screen.findByRole("dialog");
      expect(mascoteAtras()).toContain("mascote-arquivo");
    } finally {
      primeiro.mascote = mascote;
    }
  });

  it("com o cartão na largura toda, o alvo rola para acima do cartão e do mascote", async () => {
    const caixa = vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ top: 500, left: 0, width: 700, height: 200 } as DOMRect);
    const posicao = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockReturnValue(-84);
    try {
      montar();
      await waitFor(() => expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo"));
      // a janela do jsdom tem 768 de altura: 268 do cartão, 84 do mascote e a folga de 16
      expect(screen.getByText("filtros").style.scrollMarginBottom).toBe("368px");
    } finally {
      caixa.mockRestore();
      posicao.mockRestore();
    }
  });

  it("o cartão vai para a esquerda quando cobriria o alvo à direita", async () => {
    const caixa = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return (this.matches("[data-tutorial]")
        ? { top: 300, bottom: 700, left: 600, right: 1000, width: 400, height: 400 }
        : { top: 454, bottom: 744, left: 560, right: 1000, width: 440, height: 290 }) as DOMRect;
    });
    try {
      montar();
      await waitFor(() => expect(document.querySelector(".tutorial-envelope")).toHaveAttribute("data-lado", "esquerda"));
    } finally {
      caixa.mockRestore();
    }
  });

  describe("o lado do cartão, numa tela de 1024 por 768", () => {
    const cartao = { top: 454, width: 440, height: 290 };
    const mascote = { acima: 128, largura: 240 };

    it("sai da direita quando o alvo está embaixo do cartão", () => {
      const alvo = { top: 300, bottom: 700, left: 600, right: 1000 };
      expect(cartaoVaiParaEsquerda(alvo, cartao, mascote)).toBe(true);
    });

    it("sai da direita quando só o mascote cobre o alvo", () => {
      const alvo = { top: 340, bottom: 440, left: 800, right: 1000 };
      expect(cartaoVaiParaEsquerda(alvo, cartao, mascote)).toBe(true);
    });

    it("fica à direita quando o alvo está livre, à esquerda ou acima do mascote", () => {
      expect(cartaoVaiParaEsquerda({ top: 300, bottom: 700, left: 40, right: 440 }, cartao, mascote)).toBe(false);
      expect(cartaoVaiParaEsquerda({ top: 40, bottom: 300, left: 600, right: 1000 }, cartao, mascote)).toBe(false);
    });

    it("fica à direita quando o outro canto cobriria quase o mesmo", () => {
      expect(cartaoVaiParaEsquerda({ top: 500, bottom: 700, left: 24, right: 1000 }, cartao, mascote)).toBe(false);
      expect(cartaoVaiParaEsquerda({ top: 500, bottom: 700, left: 200, right: 1000 }, cartao, mascote)).toBe(false);
    });

    it("fica onde está com o cartão na largura toda", () => {
      const alvo = { top: 300, bottom: 700, left: 600, right: 1000 };
      expect(cartaoVaiParaEsquerda(alvo, { ...cartao, width: 700 }, mascote)).toBe(false);
    });
  });

  it("o mascote só anima para quem não pediu menos movimento", () => {
    const css = readFileSync("app/globals.css", "utf8");
    const antes = css.slice(0, css.indexOf("animation: tutorial-mascote-sobe"));
    expect(antes.slice(antes.lastIndexOf("@media"))).toContain("prefers-reduced-motion: no-preference");
    expect(css.match(/animation: tutorial-mascote-sobe/g)).toHaveLength(1);
  });

  it("desmontar com o tutorial aberto tira o destaque", async () => {
    const { unmount } = montar();
    await waitFor(() => expect(screen.getByText("filtros")).toHaveAttribute("data-tutorial-ativo"));
    unmount();
    expect(document.querySelector("[data-tutorial-ativo]")).toBeNull();
  });
});

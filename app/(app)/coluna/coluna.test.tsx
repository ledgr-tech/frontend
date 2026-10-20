import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mostrarAjudaNaColuna } from "@/lib/eventos";
import { ajudaDaTela } from "../ajuda/paginas";
import { ProvedorDaColuna, ColunaAgora, ColunaDaTela, BotaoAgora, useColuna } from "./coluna";

let caminho = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

function Espia() {
  const { pendente } = useColuna();
  return <p data-testid="pendente">{String(pendente)}</p>;
}

function telas(largas: boolean) {
  window.matchMedia = ((q: string) => ({ matches: largas, media: q, addEventListener() {}, removeEventListener() {} })) as never;
}

function montar(tela?: React.ReactNode) {
  return render(
    <ProvedorDaColuna>
      <ColunaAgora />
      <Espia />
      {tela}
    </ProvedorDaColuna>,
  );
}

describe("coluna Agora", () => {
  beforeEach(() => {
    caminho = "/dashboard";
    telas(true);
    delete document.documentElement.dataset.coluna;
    window.localStorage.clear();
  });

  it("mostra o conteúdo da tela dentro da coluna", () => {
    montar(<ColunaDaTela>meu agora</ColunaDaTela>);
    const coluna = screen.getByRole("complementary", { name: "O que fazer agora" });
    expect(coluna).toHaveTextContent("meu agora");
  });

  it("recolhe e abre pelo botão", async () => {
    const user = userEvent.setup();
    montar(<ColunaDaTela>x</ColunaDaTela>);
    await user.click(screen.getByRole("button", { name: "Recolher a coluna" }));
    expect(document.documentElement.dataset.coluna).toBe("recolhida");
    expect(screen.getByRole("button", { name: "Abrir a coluna" })).toBeInTheDocument();
  });

  it("pendente fica true enquanto a tela pendente está montada", () => {
    const { rerender } = montar(<ColunaDaTela pendente>x</ColunaDaTela>);
    expect(screen.getByTestId("pendente")).toHaveTextContent("true");
    rerender(
      <ProvedorDaColuna>
        <ColunaAgora />
        <Espia />
      </ProvedorDaColuna>,
    );
    expect(screen.getByTestId("pendente")).toHaveTextContent("false");
  });

  it("na divergência, a coluna continua só com uma ColunaDaTela montada embaixo", () => {
    caminho = "/conciliacoes/1/2";
    const { unmount } = montar(<ColunaDaTela>comparação</ColunaDaTela>);
    expect(screen.getByRole("complementary", { name: "O que fazer agora" })).toHaveTextContent("comparação");
    unmount();
    montar();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("em tela sem coluna não desenha nada", () => {
    caminho = "/configuracoes";
    montar(<ColunaDaTela>x</ColunaDaTela>);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("mostrarParaTutorial abre sem gravar e desfaz só o que mudou", () => {
    document.documentElement.dataset.coluna = "recolhida";
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
    const caixa: { api?: ReturnType<typeof useColuna> } = {};
    function Pega() {
      const v = useColuna();
      useEffect(() => {
        caixa.api = v;
      });
      return null;
    }
    render(
      <ProvedorDaColuna>
        <Pega />
      </ProvedorDaColuna>,
    );
    let desfazer!: () => void;
    act(() => {
      desfazer = caixa.api!.mostrarParaTutorial();
    });
    expect(document.documentElement.dataset.coluna).toBe("aberta");
    expect(window.localStorage.getItem("ledgr_coluna")).toBeNull();
    act(() => desfazer());
    expect(document.documentElement.dataset.coluna).toBe("recolhida");
  });

  it("mostrarParaTutorial nas telas menores abre o painel e o desfaz", () => {
    telas(false);
    const caixa: { api?: ReturnType<typeof useColuna> } = {};
    function Pega() {
      const v = useColuna();
      useEffect(() => {
        caixa.api = v;
      });
      return <p data-testid="painel">{String(v.painelAberto)}</p>;
    }
    render(
      <ProvedorDaColuna>
        <Pega />
      </ProvedorDaColuna>,
    );
    let desfazer!: () => void;
    act(() => {
      desfazer = caixa.api!.mostrarParaTutorial();
    });
    expect(screen.getByTestId("painel")).toHaveTextContent("true");
    act(() => desfazer());
    expect(screen.getByTestId("painel")).toHaveTextContent("false");
  });

  describe("ajuda da tela", () => {
    it("na comparação, mostra os passos e o link para a Central", () => {
      caminho = "/conciliacoes/b";
      montar();
      const bloco = screen.getByRole("region", { name: "Ajuda desta tela" });
      expect(bloco).toHaveAttribute("id", "coluna-ajuda");
      const pagina = ajudaDaTela("comparacao")!;
      expect(bloco).toHaveTextContent(pagina.passos[0].titulo);
      expect(screen.getByRole("link", { name: "Abrir na Central" })).toHaveAttribute("href", "/ajuda/comparacao");
    });

    it("sem página (histórico), mostra só o link da Central de ajuda", () => {
      caminho = "/historico";
      montar();
      const bloco = screen.getByRole("region", { name: "Ajuda desta tela" });
      expect(bloco.querySelector("ol")).toBeNull();
      expect(screen.getByRole("link", { name: "Central de ajuda" })).toHaveAttribute("href", "/ajuda");
    });

    it("o pedido do menu, com a coluna recolhida, abre sem gravar e foca o título", () => {
      caminho = "/conciliacoes/b";
      document.documentElement.dataset.coluna = "recolhida";
      montar();
      act(() => mostrarAjudaNaColuna());
      expect(document.documentElement.dataset.coluna).toBe("aberta");
      expect(window.localStorage.getItem("ledgr_coluna")).toBeNull();
      expect(screen.getByRole("heading", { name: "Ajuda desta tela" })).toHaveFocus();
    });

    it("nas telas menores, o pedido abre o painel", () => {
      caminho = "/conciliacoes/b";
      telas(false);
      render(
        <ProvedorDaColuna>
          <BotaoAgora />
          <ColunaAgora />
        </ProvedorDaColuna>,
      );
      act(() => mostrarAjudaNaColuna());
      const painel = screen.getByRole("dialog", { name: "O que fazer agora" });
      expect(painel).toHaveTextContent("Ajuda desta tela");
      expect(screen.getByRole("heading", { name: "Ajuda desta tela" })).toHaveFocus();
    });
  });

  describe("telas menores", () => {
    function montarMenor(pendente = false) {
      telas(false);
      return render(
        <ProvedorDaColuna>
          <BotaoAgora />
          <ColunaAgora />
          <Espia />
          <ColunaDaTela pendente={pendente}>meu agora</ColunaDaTela>
        </ProvedorDaColuna>,
      );
    }

    it("mostra o botão e deixa a coluna escondida", () => {
      montarMenor();
      expect(screen.getByRole("button", { name: "Agora" })).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("clicar abre o painel não modal com o conteúdo da tela", async () => {
      const user = userEvent.setup();
      montarMenor();
      await user.click(screen.getByRole("button", { name: "Agora" }));
      const painel = screen.getByRole("dialog", { name: "O que fazer agora" });
      expect(painel).toHaveTextContent("meu agora");
      expect(painel).not.toHaveAttribute("aria-modal");
      expect(screen.getByRole("button", { name: "Agora" })).toHaveAttribute("aria-expanded", "true");
    });

    it("Esc fecha e devolve o foco ao botão", async () => {
      const user = userEvent.setup();
      montarMenor();
      await user.click(screen.getByRole("button", { name: "Agora" }));
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Agora" })).toHaveFocus();
    });

    it("Fechar fecha e devolve o foco ao botão", async () => {
      const user = userEvent.setup();
      montarMenor();
      await user.click(screen.getByRole("button", { name: "Agora" }));
      await user.click(screen.getByRole("button", { name: "Fechar" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Agora" })).toHaveFocus();
    });

    it("o ponto aparece só com pendente", () => {
      const { container, unmount } = montarMenor(true);
      expect(container.querySelector(".coluna-ponto")).toBeInTheDocument();
      unmount();
      const outro = montarMenor(false);
      expect(outro.container.querySelector(".coluna-ponto")).not.toBeInTheDocument();
    });

    it("trocar de tela com o painel aberto fecha o painel", async () => {
      const user = userEvent.setup();
      const arvore = () => (
        <ProvedorDaColuna>
          <BotaoAgora />
          <ColunaAgora />
        </ProvedorDaColuna>
      );
      telas(false);
      const { rerender } = render(arvore());
      await user.click(screen.getByRole("button", { name: "Agora" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      caminho = "/extratos";
      rerender(arvore());
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Agora" })).toHaveAttribute("aria-expanded", "false");
    });

    it("em telas largas o botão não aparece", () => {
      telas(true);
      render(
        <ProvedorDaColuna>
          <BotaoAgora />
        </ProvedorDaColuna>,
      );
      expect(screen.queryByRole("button", { name: "Agora" })).not.toBeInTheDocument();
    });
  });
});

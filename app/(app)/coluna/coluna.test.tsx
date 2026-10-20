import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaColuna, ColunaAgora, ColunaDaTela, useColuna } from "./coluna";

let caminho = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

function Espia() {
  const { pendente } = useColuna();
  return <p data-testid="pendente">{String(pendente)}</p>;
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
});

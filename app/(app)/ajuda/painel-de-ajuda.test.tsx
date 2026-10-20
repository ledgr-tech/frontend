import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { abrirAjuda } from "@/lib/eventos";
import { ProvedorDaColuna, ColunaDaTela } from "../coluna/coluna";
import { ajudaDaTela } from "./paginas";
import { PainelDaRota } from "./painel-de-ajuda";

function montar(extra?: React.ReactNode) {
  return render(
    <ProvedorDaColuna>
      <PainelDaRota />
      {extra}
    </ProvedorDaColuna>,
  );
}

let caminho = "/conciliacoes/b/lc-1";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

describe("PainelDaRota", () => {
  afterEach(() => {
    caminho = "/conciliacoes/b/lc-1";
  });

  it('fica fechado até o "Ajuda desta tela", e abre com a ajuda da tela do endereço', () => {
    montar();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => abrirAjuda());
    const pagina = ajudaDaTela("divergencia")!;
    const painel = screen.getByRole("dialog", { name: `Ajuda: ${pagina.titulo}` });
    expect(screen.getByRole("heading", { name: pagina.chamada })).toHaveFocus();
    expect(painel).toHaveTextContent(pagina.passos[0].titulo);
    expect(
      screen.getByRole("link", { name: /Abrir a página completa/ }),
    ).toHaveAttribute("href", `/ajuda/${pagina.id}`);
    // sem gravação, sem player vazio
    expect(painel.querySelector("video")).toBeNull();
  });

  it("nas telas com coluna, o painel não abre: a ajuda está na coluna", () => {
    caminho = "/conciliacoes/nova";
    montar();
    act(() => abrirAjuda());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("na divergência por cima da Comparação, a coluna continua e o painel não abre", () => {
    montar(<ColunaDaTela>comparação</ColunaDaTela>);
    act(() => abrirAjuda());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("na linha da comparação, é a ajuda de justificar", () => {
    caminho = "/conciliacoes/b/lc-1";
    montar();
    act(() => abrirAjuda());
    expect(
      screen.getByRole("dialog", { name: "Ajuda: Justificar uma divergência" }),
    ).toBeInTheDocument();
  });

  it("onde não há página, não abre nada", () => {
    caminho = "/configuracoes";
    montar();
    act(() => abrirAjuda());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fecha pelo X e pelo Esc", async () => {
    const user = userEvent.setup();
    montar();
    act(() => abrirAjuda());
    await user.click(screen.getByRole("button", { name: "Fechar a ajuda" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => abrirAjuda());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

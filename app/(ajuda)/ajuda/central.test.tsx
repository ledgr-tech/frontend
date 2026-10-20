import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CentralDeAjuda } from "./central";
import { PAGINAS, ajudaDaTela } from "./paginas";
import { TELAS_DO_TUTORIAL } from "@/lib/preferencias";
import PaginaDaAjuda from "./[pagina]/page";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: vi.fn(),
}));

describe("CentralDeAjuda", () => {
  it("mostra a tela: título, para que serve, cada funcionalidade com o como fazer", () => {
    render(<CentralDeAjuda id="fechamentos" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Fechamentos" }),
    ).toBeInTheDocument();

    const funcoes = screen
      .getAllByRole("heading", { level: 2 })
      .map((titulo) => titulo.textContent);
    expect(funcoes).toEqual(
      PAGINAS.find((p) => p.id === "fechamentos")!.funcoes.map((f) => f.titulo),
    );

    const fechar = screen.getByRole("region", { name: "Fechar o mês" });
    expect(within(fechar).getByText("Como fazer")).toBeInTheDocument();
    // o **negrito** vira <b>, o nome do botão como aparece na tela
    expect(within(fechar).getByText("Fechar mesmo assim").tagName).toBe("B");
  });

  it('"Nesta página" lista as funcionalidades com a âncora de cada uma', () => {
    render(<CentralDeAjuda id="comparacao" />);
    const indice = screen.getByRole("complementary", { name: "Nesta página" });
    const links = within(indice).getAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "#resumo");
    // uma seção por vez é a atual
    expect(links.filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
    for (const link of links) {
      expect(document.getElementById(link.getAttribute("href")!.slice(1))).not.toBeNull();
    }
  });

  it("anterior e próxima seguem a ordem das telas", () => {
    const { rerender } = render(<CentralDeAjuda id={PAGINAS[0].id} />);
    expect(screen.queryByRole("link", { name: /Anterior/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Próxima/ })).toHaveAttribute(
      "href",
      `/ajuda/${PAGINAS[1].id}`,
    );
    rerender(<CentralDeAjuda id={PAGINAS.at(-1)!.id} />);
    expect(screen.getByRole("link", { name: /Anterior/ })).toHaveAttribute(
      "href",
      `/ajuda/${PAGINAS.at(-2)!.id}`,
    );
    expect(screen.queryByRole("link", { name: /Próxima/ })).not.toBeInTheDocument();
  });

  it("a tela aberta fica marcada na lista das telas", () => {
    render(<CentralDeAjuda id="extratos" />);
    const telas = screen.getByRole("navigation", { name: "Telas do Ledgr" });
    expect(within(telas).getAllByRole("link")).toHaveLength(PAGINAS.length);
    expect(within(telas).getByRole("link", { name: "Extratos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("sem vídeo, a capa diz que ele vem e lista os capítulos", () => {
    render(<CentralDeAjuda id="historico" />);
    expect(screen.getByText("Vídeo desta tela em breve")).toBeInTheDocument();
    expect(document.querySelector("video")).toBeNull();
    const capitulos = screen.getByRole("list", { name: "Capítulos do vídeo" });
    expect(within(capitulos).getAllByRole("listitem")).toHaveLength(
      PAGINAS.find((p) => p.id === "historico")!.funcoes.length,
    );
  });

  it("clicar numa imagem a abre grande, e Fechar fecha", async () => {
    const user = userEvent.setup();
    render(<CentralDeAjuda id="extratos" />);
    await user.click(screen.getByRole("button", { name: /Ampliar a imagem de O painel do arquivo/ }));
    const janela = screen.getByRole("dialog", { hidden: true });
    expect(janela).toHaveAttribute("aria-label", "O painel do arquivo");
    await user.click(within(janela).getByRole("button", { name: "Fechar", hidden: true }));
    expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument();
  });
});

describe("a rota /ajuda/[pagina]", () => {
  it("dá 404 para uma página que não existe", async () => {
    await expect(
      PaginaDaAjuda({
        params: Promise.resolve({ pagina: "nao-existe" }),
      } as PageProps<"/ajuda/[pagina]">),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("o conteúdo da ajuda", () => {
  it("ids únicos, e toda funcionalidade tem o que faz", () => {
    const ids = PAGINAS.map((pagina) => pagina.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pagina of PAGINAS) {
      expect(pagina.funcoes.length).toBeGreaterThan(0);
      const funcoes = pagina.funcoes.map((f) => f.id);
      expect(new Set(funcoes).size).toBe(funcoes.length);
      for (const funcao of pagina.funcoes) expect(funcao.faz).not.toBe("");
    }
  });

  it("toda imagem existe em public/", () => {
    for (const pagina of PAGINAS) {
      for (const imagem of [pagina.capa, ...pagina.funcoes.map((f) => f.imagem)]) {
        if (imagem) expect(existsSync(join("public", imagem.src)), imagem.src).toBe(true);
      }
    }
  });

  it("toda tela com tutorial tem a sua página", () => {
    for (const tela of TELAS_DO_TUTORIAL) expect(ajudaDaTela(tela), tela).toBeDefined();
    expect(ajudaDaTela("divergencia")?.id).toBe("detalhe-da-linha");
    expect(ajudaDaTela(null)).toBeUndefined();
  });
});

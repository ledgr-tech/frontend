import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CentralDeAjuda } from "./central";
import { PAGINAS, ajudaDaTela, procurarAjuda } from "./paginas";
import PaginaDaAjuda from "./[pagina]/page";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  redirect: vi.fn(),
}));

describe("CentralDeAjuda", () => {
  it("mostra a página escolhida: passos numerados na tela, perguntas e as vizinhas", () => {
    render(<CentralDeAjuda id="nova-conciliacao" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Central de ajuda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Nova conciliação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fluxo principal · 1 de 5")).toBeInTheDocument();

    const indice = screen.getByRole("navigation", { name: "Páginas da ajuda" });
    expect(
      within(indice).getByRole("link", { name: "Nova conciliação" }),
    ).toHaveAttribute("aria-current", "page");

    const passos = screen.getByRole("region", { name: "Passo a passo" });
    expect(within(passos).getAllByRole("listitem")).toHaveLength(3);
    // um número sobre a miniatura para cada passo
    expect(passos.querySelectorAll(".ajd-marca")).toHaveLength(3);

    expect(screen.getByText("Posso enviar PDF?")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Anterior/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Próxima Apontar as colunas do CSV/ }),
    ).toHaveAttribute("href", "/ajuda/apontar-colunas");
  });

  it("passar o mouse num passo realça o número dele na tela", async () => {
    const user = userEvent.setup();
    render(<CentralDeAjuda id="comparacao" />);
    const passos = screen.getByRole("region", { name: "Passo a passo" });
    await user.hover(within(passos).getByText("Revise por categoria"));
    expect(
      passos.querySelector('.ajd-marca[data-realce="true"]'),
    ).toHaveTextContent("2");
  });

  it("procura sem acento e diz quando não acha", async () => {
    const user = userEvent.setup();
    render(<CentralDeAjuda id="nova-conciliacao" />);
    const indice = screen.getByRole("navigation", { name: "Páginas da ajuda" });

    await user.type(
      screen.getByRole("searchbox", { name: "Procurar na ajuda" }),
      "tolerancia",
    );
    expect(
      within(indice)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(expect.arrayContaining(["Tolerância de data"]));
    expect(
      within(indice).queryByRole("link", { name: "Apontar as colunas do CSV" }),
    ).not.toBeInTheDocument();

    await user.clear(
      screen.getByRole("searchbox", { name: "Procurar na ajuda" }),
    );
    await user.type(
      screen.getByRole("searchbox", { name: "Procurar na ajuda" }),
      "boleto vencido",
    );
    expect(within(indice).getByRole("status")).toHaveTextContent(
      "Nada encontrado",
    );
  });

  it("o cartão do assistente abre a conversa do menu lateral", async () => {
    const ouvinte = vi.fn();
    window.addEventListener("ledgr:abrir-assistente", ouvinte);
    const user = userEvent.setup();
    render(<CentralDeAjuda id="justificar" />);
    await user.click(
      screen.getByRole("button", { name: /Ficou alguma dúvida/ }),
    );
    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener("ledgr:abrir-assistente", ouvinte);
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
  it("cada página tem passos, e todo link aponta para uma página", () => {
    const ids = PAGINAS.map((pagina) => pagina.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pagina of PAGINAS) {
      expect(pagina.passos.length).toBeGreaterThan(0);
      if (pagina.seDerErrado) expect(ids).toContain(pagina.seDerErrado.pagina);
    }
  });

  it("liga as telas do app às páginas", () => {
    expect(ajudaDaTela("nova-conciliacao")?.id).toBe("nova-conciliacao");
    expect(ajudaDaTela("comparacao")?.id).toBe("comparacao");
    expect(ajudaDaTela("divergencia")?.id).toBe("justificar");
    expect(ajudaDaTela("extratos")).toBeUndefined();
    expect(ajudaDaTela(null)).toBeUndefined();
  });

  it("a busca vazia lista tudo", () => {
    expect(procurarAjuda("  ")).toEqual(PAGINAS);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Configuracoes } from "./configuracoes";

// a tolerância é do backend; aqui a action devolve o que ele responderia
const toleranciaDaUltimaConciliacao = vi.fn<() => Promise<number | null>>();
vi.mock("./conciliacoes/acoes", () => ({
  toleranciaDaUltimaConciliacao: () => toleranciaDaUltimaConciliacao(),
}));

const EMAIL = "financeiro@telhacerta.com.br";

function abrir(props: Partial<Parameters<typeof Configuracoes>[0]> = {}) {
  const onFechar = vi.fn();
  const onSair = vi.fn();
  const onTema = vi.fn();
  render(
    <Configuracoes aberta email={EMAIL} onFechar={onFechar} onSair={onSair} onTema={onTema} {...props} />,
  );
  return { onFechar, onSair, onTema };
}

/** O item da seção no lado esquerdo da janela. */
function secao(nome: string) {
  return screen.getByRole("button", { name: nome });
}

describe("Configuracoes", () => {
  beforeEach(() => {
    toleranciaDaUltimaConciliacao.mockReset();
    toleranciaDaUltimaConciliacao.mockResolvedValue(2);
    window.localStorage.clear();
    delete document.documentElement.dataset.tema;
    delete document.documentElement.dataset.densidade;
    delete document.documentElement.dataset.menu;
  });

  it("opens as a window in the middle of the screen, on the appearance section", () => {
    abrir();
    const janela = screen.getByRole("dialog", { name: "Configurações" });
    expect(janela).toHaveAttribute("open");
    expect(within(janela).getByRole("heading", { name: "Aparência" })).toBeInTheDocument();
    expect(within(janela).getByRole("button", { name: "Aparência" })).toHaveAttribute("aria-current", "page");
  });

  it("has nothing inside while closed", () => {
    abrir({ aberta: false });
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("switches the theme, and following the system forgets the choice", async () => {
    const user = userEvent.setup();
    const { onTema } = abrir();

    await user.click(screen.getByRole("button", { name: "Escuro" }));
    expect(document.documentElement.dataset.tema).toBe("escuro");
    expect(window.localStorage.getItem("ledgr_tema")).toBe("escuro");
    expect(onTema).toHaveBeenLastCalledWith("escuro");

    await user.click(screen.getByRole("button", { name: "Sistema" }));
    expect(document.documentElement.dataset.tema).toBeUndefined();
    expect(window.localStorage.getItem("ledgr_tema")).toBeNull();
    expect(screen.getByRole("button", { name: "Sistema" })).toHaveAttribute("aria-pressed", "true");
  });

  it("changes the table density and the side menu on the spot", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getByRole("button", { name: "Compacta" }));
    expect(document.documentElement.dataset.densidade).toBe("compacta");

    await user.click(screen.getByRole("button", { name: "Recolhido" }));
    expect(document.documentElement.dataset.menu).toBe("recolhido");
    await user.click(screen.getByRole("button", { name: "Aberto" }));
    expect(document.documentElement.dataset.menu).toBe("aberto");
  });

  it("shows the date tolerance the backend used last, with no control that pretends to save it", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(secao("Conciliação"));
    const linha = (await screen.findByText("2 dias")).closest("li")!;
    expect(within(linha).getByText("Tolerância de data")).toBeInTheDocument();
    expect(within(linha).queryByRole("button")).not.toBeInTheDocument();
  });

  it("says when there is no conciliation to read the tolerance from", async () => {
    toleranciaDaUltimaConciliacao.mockResolvedValue(null);
    const user = userEvent.setup();
    abrir();

    await user.click(secao("Conciliação"));
    expect(await screen.findByText("Sem conciliação ainda")).toBeInTheDocument();
  });

  it("shows the account email and signs out from there", async () => {
    const user = userEvent.setup();
    const { onSair } = abrir();

    await user.click(secao("Conta"));
    expect(screen.getByText(EMAIL)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sair" }));
    expect(onSair).toHaveBeenCalled();
  });

  it("lists the keyboard shortcuts that exist", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(secao("Atalhos de teclado"));
    expect(screen.getByText("Buscar valor, fornecedor ou data")).toBeInTheDocument();
    expect(screen.getByText("Abrir as configurações")).toBeInTheDocument();
  });

  it("searches every section, ignoring accents, and says when nothing matches", async () => {
    const user = userEvent.setup();
    abrir();

    await user.type(screen.getByRole("searchbox", { name: "Procurar nas configurações" }), "tolerancia");
    expect(screen.getByRole("heading", { name: "Conciliação" })).toBeInTheDocument();
    expect(screen.getByText("Tolerância de data")).toBeInTheDocument();
    expect(screen.queryByText("Densidade das tabelas")).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "xyz");
    expect(screen.getByText("Nada encontrado para “xyz”.")).toBeInTheDocument();
  });

  it("closes from the close button", async () => {
    const user = userEvent.setup();
    const { onFechar } = abrir();

    await user.click(screen.getByRole("button", { name: "Fechar configurações" }));
    expect(onFechar).toHaveBeenCalled();
  });
});

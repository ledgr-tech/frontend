import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FalhaAoCarregar } from "./falha-ao-carregar";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  useParams: () => ({}),
}));

describe("FalhaAoCarregar", () => {
  it.each([
    [0, "não conseguiu falar com o servidor", "mascote-tomadas"],
    [undefined, "não conseguiu falar com o servidor", "mascote-tomadas"],
    [503, "não conseguiu falar com o servidor", "mascote-tomadas"],
    [429, "muitos pedidos seguidos", "mascote-neutro"],
    [403, "não deu certo desta vez", "mascote-neutro"],
  ])("com status %s diz a causa certa", (status, texto, mascote) => {
    render(<FalhaAoCarregar oQue="os fechamentos" status={status} />);
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível carregar os fechamentos.");
    expect(alerta).toHaveTextContent(new RegExp(texto, "i"));
    expect(alerta).toHaveTextContent("Nenhum dado foi alterado.");
    expect(document.querySelector("img")?.getAttribute("src")).toContain(mascote);
  });

  it("o título é h2 dentro de uma tela com cabeçalho", () => {
    render(<FalhaAoCarregar oQue="os extratos" status={0} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Não foi possível carregar os extratos.");
  });

  it("Tentar de novo relê a página no servidor", async () => {
    render(<FalhaAoCarregar oQue="os fechamentos" status={0} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("a tela que carrega no cliente usa o próprio tentar", async () => {
    const tentar = vi.fn();
    refresh.mockClear();
    render(<FalhaAoCarregar oQue="a conciliação" tentar={tentar} />);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(tentar).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sem voltar, não mostra o segundo botão", () => {
    render(<FalhaAoCarregar oQue="a visão geral" status={0} voltar={null} />);
    expect(screen.queryByRole("link", { name: "Ir para a visão geral" })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NaoEncontrada from "./not-found";
import { ErroInesperado } from "./tela-de-aviso";

describe("NaoEncontrada (404)", () => {
  it("says the page does not exist and offers the app and the site", () => {
    render(<NaoEncontrada />);
    expect(screen.getByRole("heading", { level: 1, name: "Esta página não existe." })).toBeInTheDocument();
    // quem não está logado cai no login pelo layout do app: o mesmo link serve aos dois
    expect(screen.getByRole("link", { name: "Ir para o Ledgr" })).toHaveAttribute("href", "/visao-geral");
    expect(screen.getByRole("link", { name: "Ver o site" })).toHaveAttribute("href", "/");
    // o que não foi achado, o mascote procura de lupa
    expect(document.querySelector("img")?.getAttribute("src")).toContain("mascote-lupa");
  });
});

describe("ErroInesperado", () => {
  const voltar = { href: "/visao-geral", rotulo: "Ir para a visão geral" };

  it("tries again and shows the server's error code for support, never the raw message", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const erro = Object.assign(new Error("relation \"conciliacoes\" does not exist"), { digest: "3141592653" });
    render(<ErroInesperado error={erro} retry={retry} voltar={voltar} />);

    expect(screen.getByRole("heading", { name: "Algo deu errado nesta tela." })).toBeInTheDocument();
    expect(document.querySelector("img")?.getAttribute("src")).toContain("mascote-neutro");
    expect(screen.getByText("3141592653")).toBeInTheDocument();
    expect(screen.queryByText(/does not exist/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ledgrtech@gmail.com" })).toHaveAttribute("href", "mailto:ledgrtech@gmail.com");
    expect(screen.getByRole("link", { name: "Ir para a visão geral" })).toHaveAttribute("href", "/visao-geral");

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("leaves the code out when the error has none", () => {
    render(<ErroInesperado error={new Error("falhou no navegador")} retry={() => {}} voltar={voltar} />);
    expect(screen.queryByText(/com o código/)).not.toBeInTheDocument();
  });
});

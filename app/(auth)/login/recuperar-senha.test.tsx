import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecuperarSenha } from "./recuperar-senha";

describe("RecuperarSenha", () => {
  it("renders nothing while closed", () => {
    render(<RecuperarSenha aberto={false} emailInicial="" onFechar={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says the e-mail recovery is not live and points to support, instead of pretending to send a code", () => {
    render(<RecuperarSenha aberto emailInicial="financeiro@telhacerta.com.br" onFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog", { name: "Esqueceu a senha?" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    // o rótulo pequeno acima do título é só visual: o único título do card é "Esqueceu a senha?"
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    // o parágrafo que descreve a janela, conferido pelo texto (a descrição calculada junta espaço ao <strong>)
    const texto = document.getElementById(dialogo.getAttribute("aria-describedby") ?? "");
    expect(texto).toHaveTextContent(
      "A recuperação por e-mail ainda não está no ar. Escreva para ledgrtech@gmail.com a partir de financeiro@telhacerta.com.br, e a gente ajuda você a voltar a entrar.",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/código/i)).not.toBeInTheDocument();
  });

  it("opens the support e-mail with the subject, without the person's e-mail in the link, and focuses it", () => {
    render(<RecuperarSenha aberto emailInicial="financeiro@telhacerta.com.br" onFechar={() => {}} />);
    const escrever = screen.getByRole("link", { name: "Escrever para o suporte" });
    expect(escrever).toHaveAttribute("href", "mailto:ledgrtech@gmail.com?subject=Recuperar%20acesso%20ao%20Ledgr");
    expect(escrever).toHaveFocus();
  });

  it("asks to write from the account e-mail when none was typed on the login", () => {
    render(<RecuperarSenha aberto emailInicial="  " onFechar={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveTextContent(/a partir do e-mail da sua conta, e a gente/);
  });

  it("closes on Escape, on a click outside the card and on 'Voltar ao login', but not on a click inside", async () => {
    const user = userEvent.setup();
    const onFechar = vi.fn();
    render(<RecuperarSenha aberto emailInicial="" onFechar={onFechar} />);

    await user.click(screen.getByRole("dialog"));
    expect(onFechar).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(onFechar).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("recuperar-fundo"));
    expect(onFechar).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("button", { name: "Voltar ao login" }));
    expect(onFechar).toHaveBeenCalledTimes(3);
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecuperarSenha } from "./recuperar-senha";

describe("RecuperarSenha", () => {
  it("renders nothing while closed", () => {
    render(<RecuperarSenha aberto={false} emailInicial="" onFechar={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as a modal card with the e-mail field prefilled and focused", () => {
    render(<RecuperarSenha aberto emailInicial="financeiro@telhacerta.com.br" onFechar={() => {}} />);
    const dialogo = screen.getByRole("dialog", { name: "Esqueceu a senha?" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    // o rótulo pequeno acima do título é só visual: o único título do card é "Esqueceu a senha?"
    expect(screen.getAllByRole("heading")).toHaveLength(1);
    const campo = screen.getByLabelText("E-mail da conta");
    expect(campo).toHaveValue("financeiro@telhacerta.com.br");
    expect(campo).toHaveFocus();
  });

  it("shows an error and does not send when the e-mail looks incomplete", async () => {
    const user = userEvent.setup();
    render(<RecuperarSenha aberto emailInicial="" onFechar={() => {}} />);

    await user.type(screen.getByLabelText("E-mail da conta"), "financeiro@");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Confira o e-mail: parece incompleto.");
    // mesmo estilo de erro do login: mensagem junto ao campo, ligada a ele
    const campo = screen.getByLabelText("E-mail da conta");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription("Confira o e-mail: parece incompleto.");
    expect(screen.getByRole("alert")).toHaveClass("campo-erro");
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
  });

  it("shows the sending state, then confirms the code was sent", async () => {
    const user = userEvent.setup();
    render(<RecuperarSenha aberto emailInicial="financeiro@telhacerta.com.br" onFechar={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();

    expect(await screen.findByRole("heading", { name: "Confira seu e-mail." }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/financeiro@telhacerta\.com\.br/)).toBeInTheDocument();
    expect(screen.getByText(/caixa de spam/)).toBeInTheDocument();
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

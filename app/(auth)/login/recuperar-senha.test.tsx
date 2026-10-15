import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecuperarSenha } from "./recuperar-senha";

// a Server Action é a fronteira com o backend: aqui importa o que a tela faz com a resposta
const pedirRecuperacaoSenha = vi.fn();
vi.mock("../acoes", () => ({
  pedirRecuperacaoSenha: (...args: unknown[]) => pedirRecuperacaoSenha(...args),
}));

beforeEach(() => {
  pedirRecuperacaoSenha.mockReset().mockResolvedValue({ ok: true });
});

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
    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Confira o e-mail: parece incompleto.");
    // mesmo estilo de erro do login: mensagem junto ao campo, ligada a ele
    const campo = screen.getByLabelText("E-mail da conta");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo).toHaveAccessibleDescription("Confira o e-mail: parece incompleto.");
    expect(screen.getByRole("alert")).toHaveClass("campo-erro");
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
    expect(pedirRecuperacaoSenha).not.toHaveBeenCalled();
  });

  it("shows the sending state, asks the backend for the link, then confirms it was sent", async () => {
    const user = userEvent.setup();
    render(<RecuperarSenha aberto emailInicial="financeiro@telhacerta.com.br" onFechar={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();

    expect(await screen.findByRole("heading", { name: "Confira seu e-mail." }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/financeiro@telhacerta\.com\.br/)).toBeInTheDocument();
    expect(screen.getByText(/caixa de spam/)).toBeInTheDocument();
    expect(pedirRecuperacaoSenha).toHaveBeenCalledWith("financeiro@telhacerta.com.br");
  });

  it.each([
    ["indisponivel", "A recuperação de senha está indisponível agora. Tente de novo mais tarde."],
    ["muitas_tentativas", "Muitos pedidos seguidos. Espere um minuto e tente de novo."],
    ["falha", "Não foi possível enviar agora. Tente de novo em instantes."],
  ])("stays on the form with a message when the backend answers %s", async (erro, mensagem) => {
    pedirRecuperacaoSenha.mockResolvedValue({ ok: false, erro });
    const user = userEvent.setup();
    render(<RecuperarSenha aberto emailInicial="financeiro@telhacerta.com.br" onFechar={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(mensagem);
    expect(screen.getByRole("button", { name: "Enviar link" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Confira seu e-mail." })).not.toBeInTheDocument();
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

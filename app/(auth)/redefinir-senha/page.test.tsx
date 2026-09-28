import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RedefinirSenhaPage from "./page";

// a Server Action é a fronteira com o backend (POST /senha/redefinir, #66)
const redefinirSenha = vi.fn();
vi.mock("../acoes", () => ({
  redefinirSenha: (...args: unknown[]) => redefinirSenha(...args),
}));

function abrirLink(caminho: string) {
  window.history.replaceState(null, "", caminho);
}

async function preencher(senha: string, confirmacao = senha) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Senha nova"), senha);
  await user.type(screen.getByLabelText("Repita a senha nova"), confirmacao);
  await user.click(screen.getByRole("button", { name: "Salvar senha nova" }));
  return user;
}

beforeEach(() => {
  redefinirSenha.mockReset().mockResolvedValue({ ok: true });
  abrirLink("/redefinir-senha#token=token-do-link");
});

afterEach(() => {
  abrirLink("/");
});

describe("RedefinirSenhaPage", () => {
  it("lê o token do link e tira ele da barra de endereço", async () => {
    render(<RedefinirSenhaPage />);

    expect(await screen.findByLabelText("Senha nova")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/redefinir-senha");
  });

  it("manda o token e a senha nova, e depois leva para o login", async () => {
    render(<RedefinirSenhaPage />);

    await preencher("s3nha-nova-forte");

    expect(redefinirSenha).toHaveBeenCalledWith("token-do-link", "s3nha-nova-forte");
    expect(await screen.findByRole("heading", { name: "Senha redefinida." })).toBeInTheDocument();
    expect(screen.getByText(/aviso para o seu e-mail/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it.each([
    ["curta", "curta", "A senha precisa ter pelo menos 8 caracteres."],
    ["ç".repeat(37), "ç".repeat(37), "Senha longa demais. Use no máximo 72 caracteres."],
    ["s3nha-nova-forte", "s3nha-diferente", "A confirmação não bate com a senha nova."],
  ])("não envia quando a senha não passa na regra (%s)", async (senha, confirmacao, mensagem) => {
    render(<RedefinirSenhaPage />);

    await preencher(senha, confirmacao);

    expect(screen.getByRole("alert")).toHaveTextContent(mensagem);
    expect(redefinirSenha).not.toHaveBeenCalled();
  });

  it("explica que o link não vale mais e aponta para um novo pedido", async () => {
    redefinirSenha.mockResolvedValue({ ok: false, erro: "link_invalido" });
    render(<RedefinirSenhaPage />);

    await preencher("s3nha-nova-forte");

    expect(await screen.findByRole("heading", { name: "Este link não vale mais." })).toBeInTheDocument();
    expect(screen.getByText(/30 minutos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pedir um novo link" })).toHaveAttribute("href", "/login");
  });

  it.each([
    ["senha_invalida", "A senha precisa ter de 8 a 72 caracteres."],
    ["muitas_tentativas", "Muitas tentativas. Espere um minuto e tente de novo."],
    ["falha", "Não foi possível salvar agora. Tente de novo em instantes."],
  ])("fica no formulário com uma mensagem quando o backend responde %s", async (erro, mensagem) => {
    redefinirSenha.mockResolvedValue({ ok: false, erro });
    render(<RedefinirSenhaPage />);

    await preencher("s3nha-nova-forte");

    expect(await screen.findByRole("alert")).toHaveTextContent(mensagem);
    expect(screen.getByRole("button", { name: "Salvar senha nova" })).toBeEnabled();
  });

  it("sem token no endereço, não mostra o formulário", async () => {
    abrirLink("/redefinir-senha");
    render(<RedefinirSenhaPage />);

    expect(await screen.findByRole("heading", { name: "Este link está incompleto." })).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha nova")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmarEmailPage from "./page";

// a Server Action é a fronteira com o backend (POST /me/email/confirmar, #149)
const confirmarEmail = vi.fn();
vi.mock("../acoes", () => ({
  confirmarEmail: (...args: unknown[]) => confirmarEmail(...args),
}));

function abrirLink(caminho: string) {
  window.history.replaceState(null, "", caminho);
}

async function confirmar() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Confirmar e-mail novo" }));
}

beforeEach(() => {
  confirmarEmail.mockReset().mockResolvedValue({ ok: true, email: "ana@nova.com.br" });
  abrirLink("/confirmar-email#token=token-do-link");
});

afterEach(() => {
  abrirLink("/");
});

describe("ConfirmarEmailPage", () => {
  it("lê o token, tira ele da barra e só confirma com o clique", async () => {
    render(<ConfirmarEmailPage />);

    expect(await screen.findByRole("button", { name: "Confirmar e-mail novo" })).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/confirmar-email");
    // o leitor de links do e-mail abre a página sozinho: abrir não pode gastar o token
    expect(confirmarEmail).not.toHaveBeenCalled();
  });

  it("confirma, mostra o e-mail novo e leva ao login", async () => {
    render(<ConfirmarEmailPage />);

    await confirmar();

    expect(confirmarEmail).toHaveBeenCalledWith("token-do-link");
    expect(await screen.findByRole("heading", { name: "E-mail trocado." })).toBeInTheDocument();
    expect(screen.getByText(/ana@nova\.com\.br/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  });

  it.each([
    ["link_invalido", "Este link não vale mais."],
    ["email_em_uso", "Este e-mail já tem uma conta."],
  ])("explica a recusa %s", async (erro, titulo) => {
    confirmarEmail.mockResolvedValue({ ok: false, erro });
    render(<ConfirmarEmailPage />);

    await confirmar();

    expect(await screen.findByRole("heading", { name: titulo })).toBeInTheDocument();
  });

  it("deixa tentar de novo quando o servidor falha", async () => {
    confirmarEmail.mockResolvedValueOnce({ ok: false, erro: "falha" });
    render(<ConfirmarEmailPage />);

    await confirmar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível confirmar agora.");

    await confirmar();
    expect(await screen.findByRole("heading", { name: "E-mail trocado." })).toBeInTheDocument();
  });

  it("avisa que o link está incompleto sem token", async () => {
    abrirLink("/confirmar-email");
    render(<ConfirmarEmailPage />);

    expect(await screen.findByRole("heading", { name: "Este link está incompleto." })).toBeInTheDocument();
  });
});

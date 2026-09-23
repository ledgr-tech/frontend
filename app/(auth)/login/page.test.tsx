import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";
import { SAUDACOES } from "./saudacoes";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const autenticar = vi.fn();
vi.mock("@/lib/auth", () => ({
  CONTA_TESTE: { email: "financeiro@telhacerta.com.br", senha: "ledgr2026" },
  autenticar: (...args: unknown[]) => autenticar(...args),
}));

// quem abre a sessão é uma Server Action; aqui ela é só uma promessa de ok
const abrirSessao = vi.fn();
vi.mock("../acoes", () => ({
  entrar: (...args: unknown[]) => abrirSessao(...args),
}));

async function preencherEEntrar(email: string, senha: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("E-mail"), email);
  if (senha) await user.type(screen.getByLabelText("Senha"), senha);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    abrirSessao.mockReset();
    abrirSessao.mockResolvedValue(true);
    autenticar.mockReset();
    autenticar.mockReturnValue({ ok: true });
    window.localStorage.clear();
  });

  it("shows a greeting from the list, the fields and the keep-session option", () => {
    render(<LoginPage />);
    expect(SAUDACOES).toContain(screen.getByRole("heading", { level: 1 }).textContent);
    expect(screen.queryByText(/Setembro está esperando/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Manter sessão ativa" })).toBeChecked();
  });

  it("shows a different greeting from the one shown on the previous visit", () => {
    window.localStorage.setItem("ledgr_login_saudacao", "0");
    render(<LoginPage />);
    const titulo = screen.getByRole("heading", { level: 1 }).textContent;
    expect(SAUDACOES).toContain(titulo);
    expect(titulo).not.toBe(SAUDACOES[0]);
    expect(window.localStorage.getItem("ledgr_login_saudacao")).toBe(String(SAUDACOES.indexOf(titulo ?? "")));
  });

  it("types the greeting, then the underline returns to its resting width", () => {
    vi.useFakeTimers();
    try {
      render(<LoginPage />);
      const titulo = screen.getByRole("heading", { level: 1 });
      const linha = screen.getByTestId("linha-saudacao");
      expect(titulo).toHaveAttribute("data-digitando", "true");
      expect(SAUDACOES).toContain(titulo.getAttribute("aria-label"));

      // dois passos: o timer de volta do traço só é agendado depois que o React processa o fim da digitação
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(titulo).toHaveAttribute("data-digitando", "false");
      expect(linha).toHaveAttribute("data-estado", "cheia");

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(linha).toHaveAttribute("data-estado", "repouso");
      expect(linha).toHaveStyle({ width: "68px" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows floating labels that stay visible while typing, with an example only in the e-mail field", () => {
    render(<LoginPage />);
    const rotuloEmail = screen.getByText("E-mail", { selector: "label" });
    expect(rotuloEmail).toHaveClass("campo-flutuante-rotulo");
    expect(rotuloEmail).not.toHaveClass("sr-only");
    expect(screen.getByText("Senha", { selector: "label" })).toHaveClass("campo-flutuante-rotulo");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("placeholder", "nome@empresa.com.br");
    // placeholder de um espaço: o CSS usa :placeholder-shown para saber quando subir o rótulo
    expect(screen.getByLabelText("Senha")).toHaveAttribute("placeholder", " ");
  });

  it("toggles the password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const senha = screen.getByLabelText("Senha");
    expect(senha).toHaveAttribute("type", "password");

    const mostrar = screen.getByRole("button", { name: "Mostrar senha" });
    expect(mostrar).toHaveAttribute("aria-pressed", "false");
    expect(mostrar).not.toHaveTextContent(/\S/);

    await user.click(mostrar);
    expect(senha).toHaveAttribute("type", "text");

    const ocultar = screen.getByRole("button", { name: "Ocultar senha" });
    expect(ocultar).toHaveAttribute("aria-pressed", "true");
    await user.click(ocultar);
    expect(senha).toHaveAttribute("type", "password");
  });

  it("switches the mascot eye between its open and closed animated states", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const olho = () => screen.getByRole("button", { name: /(Mostrar|Ocultar) senha/ }).querySelector("svg");
    expect(olho()).toHaveAttribute("data-estado", "aberto");

    await user.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(olho()).toHaveAttribute("data-estado", "fechado");

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(olho()).toHaveAttribute("data-estado", "aberto");
  });

  it("opens the password recovery card with the typed e-mail and returns focus when it closes", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "financeiro@telhacerta.com.br");
    const gatilho = screen.getByRole("button", { name: "Esqueci a senha" });
    await user.click(gatilho);

    const dialogo = await screen.findByRole("dialog", { name: "Esqueceu a senha?" });
    expect(within(dialogo).getByLabelText("E-mail da conta")).toHaveValue("financeiro@telhacerta.com.br");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(gatilho).toHaveFocus();
  });

  it("offers Google as the only alternative sign-in", () => {
    render(<LoginPage />);
    // o botão mostra só o símbolo do Google; o nome fica para leitor de tela
    const google = screen.getByRole("button", { name: "Entrar com Google" });
    expect(google).toHaveAttribute("aria-label", "Entrar com Google");
    expect(google).not.toHaveTextContent(/\S/);
    expect(google.querySelector("svg")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Certificado digital" })).not.toBeInTheDocument();
  });

  it("signs in with Google using the test account, without validating the empty fields", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Entrar com Google" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(abrirSessao).toHaveBeenCalledWith("financeiro@telhacerta.com.br", "ledgr2026", true);
    expect(autenticar).not.toHaveBeenCalled();
  });

  it("only keeps the session in this tab when 'Manter sessão ativa' is unchecked", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("checkbox", { name: "Manter sessão ativa" }));
    await preencherEEntrar("financeiro@telhacerta.com.br", "ledgr2026");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(abrirSessao).toHaveBeenCalledWith("financeiro@telhacerta.com.br", "ledgr2026", false);
  });

  it("links to the signup without promising a number of steps", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
  });

  describe("error messages", () => {
    it("points out both empty fields next to each one and does not try to sign in", async () => {
      render(<LoginPage />);
      await preencherEEntrar("", "");

      const email = screen.getByLabelText("E-mail");
      const senha = screen.getByLabelText("Senha");
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(email).toHaveAccessibleDescription("Informe seu e-mail.");
      expect(senha).toHaveAttribute("aria-invalid", "true");
      expect(senha).toHaveAccessibleDescription("Informe sua senha.");
      expect(screen.getAllByRole("alert")).toHaveLength(2);
      expect(autenticar).not.toHaveBeenCalled();
    });

    it("flags an incomplete e-mail on the e-mail field", async () => {
      render(<LoginPage />);
      await preencherEEntrar("financeiro@telhacerta", "ledgr2026");

      const email = screen.getByLabelText("E-mail");
      expect(email).toHaveAccessibleDescription("Confira o e-mail: parece incompleto.");
      expect(screen.getByLabelText("Senha")).not.toHaveAttribute("aria-invalid");
      expect(autenticar).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    it("shows 'account not found' on the e-mail field after trying to sign in", async () => {
      autenticar.mockReturnValue({ ok: false, erro: "conta_nao_encontrada" });
      render(<LoginPage />);
      await preencherEEntrar("outra@empresa.com.br", "ledgr2026");

      const email = screen.getByLabelText("E-mail");
      await waitFor(() => expect(email).toHaveAccessibleDescription("Não encontramos conta com este e-mail. Confira o endereço."));
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
      expect(push).not.toHaveBeenCalled();
    });

    it("shows 'wrong password' on the password field", async () => {
      autenticar.mockReturnValue({ ok: false, erro: "senha_incorreta" });
      render(<LoginPage />);
      await preencherEEntrar("financeiro@telhacerta.com.br", "errada");

      const senha = screen.getByLabelText("Senha");
      await waitFor(() => expect(senha).toHaveAccessibleDescription("Senha incorreta. Confira e tente de novo."));
      expect(autenticar).toHaveBeenCalledWith("financeiro@telhacerta.com.br", "errada");
      expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-invalid");
    });

    it("shows 'too many attempts' on the password field", async () => {
      autenticar.mockReturnValue({ ok: false, erro: "muitas_tentativas" });
      render(<LoginPage />);
      await preencherEEntrar("financeiro@telhacerta.com.br", "errada");

      await waitFor(() =>
        expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(
          "Acesso pausado por segurança. Tente de novo em alguns minutos.",
        ),
      );
    });

    it("clears a field's error as soon as the person types in it", async () => {
      render(<LoginPage />);
      const user = await preencherEEntrar("", "");

      await user.type(screen.getByLabelText("E-mail"), "f");
      expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByLabelText("Senha")).toHaveAttribute("aria-invalid", "true");
    });

    it("shakes the field again on every repeated error", async () => {
      render(<LoginPage />);
      const user = await preencherEEntrar("", "");
      // quem treme é o bloco do campo (input + rótulo flutuante), para o rótulo acompanhar
      const email = screen.getByLabelText("E-mail").closest(".campo-flutuante") as HTMLElement;
      const primeiroTremor = email.getAttribute("data-tremor");
      expect(primeiroTremor).toMatch(/^(a|b)$/);

      await user.click(screen.getByRole("button", { name: "Entrar" }));
      expect(email.getAttribute("data-tremor")).toMatch(/^(a|b)$/);
      expect(email.getAttribute("data-tremor")).not.toBe(primeiroTremor);
    });
  });

  it("shows the loading state, then signs in and redirects to the dashboard", async () => {
    render(<LoginPage />);
    await preencherEEntrar("financeiro@telhacerta.com.br", "ledgr2026");

    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(autenticar).toHaveBeenCalledWith("financeiro@telhacerta.com.br", "ledgr2026");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the terms and privacy links in the footer instead of the trust notes", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "Termos de uso" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Política de privacidade" })).toBeInTheDocument();
    expect(screen.queryByText(/Sem credencial bancária/)).not.toBeInTheDocument();
    expect(screen.queryByText(/não movimenta dinheiro/)).not.toBeInTheDocument();
  });

  it("links back to the marketing site", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "← Voltar ao site" })).toHaveAttribute("href", "/");
  });
});

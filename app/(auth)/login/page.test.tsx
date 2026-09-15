import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";
import { SAUDACOES } from "./saudacoes";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const login = vi.fn();
vi.mock("@/lib/auth", () => ({
  login: (email: string) => login(email),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    login.mockClear();
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

  it("toggles the password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const senha = screen.getByLabelText("Senha");
    expect(senha).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Ver" }));
    expect(senha).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Ocultar" }));
    expect(senha).toHaveAttribute("type", "password");
  });

  it("shows an error and does not log in when the email looks incomplete", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "financeiro@telhacerta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Confira o e-mail: parece incompleto.");
    expect(login).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the loading state, then logs in and redirects to the dashboard", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "financeiro@telhacerta.com.br");
    await user.type(screen.getByLabelText("Senha"), "qualquercoisa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(screen.getByRole("button", { name: "Entrando…" })).toBeDisabled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(login).toHaveBeenCalledWith("financeiro@telhacerta.com.br");
  });

  it("links back to the marketing site", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: "← Voltar ao site" })).toHaveAttribute("href", "/");
  });
});

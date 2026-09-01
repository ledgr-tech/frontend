import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

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
  });

  it("shows the welcome-back heading and the email/password fields", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: "Bem-vinda de volta." })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("logs in and redirects to the dashboard on submit", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText("E-mail"), "financeiro@telhacerta.com.br");
    await user.type(screen.getByLabelText("Senha"), "qualquercoisa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(login).toHaveBeenCalledWith("financeiro@telhacerta.com.br");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});

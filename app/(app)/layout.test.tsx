import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AppLayout from "./layout";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
  logout: vi.fn(),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    replace.mockClear();
    getSession.mockReset();
  });

  it("redirects to /login when there's no session", () => {
    getSession.mockReturnValue(null);
    render(<AppLayout>conteúdo</AppLayout>);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renders children when a session exists", () => {
    getSession.mockReturnValue({ email: "financeiro@telhacerta.com.br" });
    render(<AppLayout>conteúdo autenticado</AppLayout>);
    expect(screen.getByText("conteúdo autenticado")).toBeInTheDocument();
  });
});

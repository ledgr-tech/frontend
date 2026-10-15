import { describe, it, expect, vi, beforeEach } from "vitest";
import AppLayout from "./layout";

const auth = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => auth(),
}));

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  // o redirect do Next interrompe a renderização lançando; o mock imita isso,
  // senão o teste seguiria para um caminho que na vida real nunca roda
  redirect: (destino: string) => {
    redirect(destino);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("./shell", () => ({
  Shell: ({ email, children }: { email: string; children: React.ReactNode }) => (
    <div data-email={email}>{children}</div>
  ),
}));

describe("AppLayout", () => {
  beforeEach(() => {
    auth.mockReset();
    redirect.mockClear();
  });

  it("manda para o login quando não há sessão", async () => {
    auth.mockResolvedValue(null);
    // a checagem é no servidor: a página protegida nem chega a ser montada
    await expect(AppLayout({ children: "conteúdo" })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("manda para o login quando a sessão veio sem e-mail", async () => {
    auth.mockResolvedValue({ user: {} });
    await expect(AppLayout({ children: "conteúdo" })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("entrega o e-mail da sessão para o shell", async () => {
    auth.mockResolvedValue({ user: { email: "financeiro@telhacerta.com.br" } });
    const elemento = await AppLayout({ children: "conteúdo" });
    expect(redirect).not.toHaveBeenCalled();
    expect(elemento.props.email).toBe("financeiro@telhacerta.com.br");
  });
});

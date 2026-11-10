import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NovaVersao } from "./nova-versao";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const BANCO = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const SISTEMA = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("NovaVersao", () => {
  beforeEach(() => push.mockClear());

  it("leva à Nova conciliação em modo reenvio, com o banco e o sistema atual", async () => {
    const user = userEvent.setup();
    render(<NovaVersao extratoBancoId={BANCO} extratoSistemaId={SISTEMA} />);
    await user.click(screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" }));

    expect(push).toHaveBeenCalledWith(`/conciliacoes/nova?banco=${BANCO}&sistemaAnterior=${SISTEMA}`);
  });

  it("mantém o texto curto na tela e o nome inteiro para o leitor de tela", () => {
    render(<NovaVersao extratoBancoId={BANCO} extratoSistemaId={SISTEMA} />);

    const botao = screen.getByRole("button", { name: "Enviar nova versão do extrato do sistema" });
    expect(botao).toHaveTextContent("Enviar nova versão");
    expect(botao).toHaveClass("nova-versao-botao");
  });

  it("sem o extrato do sistema atual não há de onde partir: o botão não aparece", () => {
    render(<NovaVersao extratoBancoId={BANCO} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

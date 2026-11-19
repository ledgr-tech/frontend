import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcoesDaAssinatura } from "./cobranca-da-conta";

const { cancelarAssinatura, manterAssinatura, refresh } = vi.hoisted(() => ({
  cancelarAssinatura: vi.fn(), manterAssinatura: vi.fn(), refresh: vi.fn(),
}));
vi.mock("../acoes", () => ({ cancelarAssinatura, manterAssinatura, darCupom: vi.fn(), listarCupons: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ID = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const NOME = "Empresa de teste";
const MOTIVO = "Solicitação de teste do operador";

beforeEach(() => {
  cancelarAssinatura.mockReset().mockResolvedValue({ ok: true });
  manterAssinatura.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

function montar(agendado = false) {
  render(<AcoesDaAssinatura id={ID} nome={NOME} agendado={agendado} fimDoPeriodo="2026-12-01T12:00:00Z" />);
}

describe("AcoesDaAssinatura", () => {
  it("só cancela agora com motivo e confirmação da conta, chamando a action uma vez", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Cancelar assinatura…" }));
    const janela = within(screen.getByRole("dialog", { name: `Cancelar a assinatura de ${NOME}?` }));
    await user.click(janela.getByRole("radio", { name: /^Agora/ }));
    const enviar = janela.getByRole("button", { name: "Cancelar agora" });
    const motivo = janela.getByRole("textbox");
    const confirmar = janela.getByRole("checkbox", { name: `Confirmo o cancelamento imediato de ${NOME}.` });
    expect(confirmar).toBeRequired();
    expect(enviar).toBeDisabled();
    await user.type(motivo, MOTIVO);
    expect(enviar).toBeDisabled();
    await user.click(enviar);
    expect(cancelarAssinatura).not.toHaveBeenCalled();
    await user.click(confirmar);
    expect(enviar).toBeEnabled();
    await user.clear(motivo);
    expect(enviar).toBeDisabled();
    await user.type(motivo, MOTIVO);
    await user.click(enviar);

    expect(cancelarAssinatura).toHaveBeenCalledExactlyOnceWith(ID, "agora", MOTIVO);
    expect(manterAssinatura).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancela no fim do período sem pedir a caixa", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Cancelar assinatura…" }));
    const janela = within(screen.getByRole("dialog"));
    expect(janela.getByRole("radio", { name: /^No fim do período/ })).toBeChecked();
    expect(janela.queryByRole("checkbox")).not.toBeInTheDocument();
    const enviar = janela.getByRole("button", { name: "Cancelar no fim do período" });
    expect(enviar).toBeDisabled();
    await user.type(janela.getByRole("textbox"), MOTIVO);
    expect(enviar).toBeEnabled();
    await user.click(enviar);
    expect(cancelarAssinatura).toHaveBeenCalledExactlyOnceWith(ID, "fim_do_periodo", MOTIVO);
  });

  it("trocar para o fim do período e voltar para agora desmarca a caixa", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Cancelar assinatura…" }));
    const janela = within(screen.getByRole("dialog"));
    await user.type(janela.getByRole("textbox"), MOTIVO);
    await user.click(janela.getByRole("radio", { name: /^Agora/ }));
    await user.click(janela.getByRole("checkbox"));
    expect(janela.getByRole("button", { name: "Cancelar agora" })).toBeEnabled();
    await user.click(janela.getByRole("radio", { name: /^No fim do período/ }));
    expect(janela.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(janela.getByRole("button", { name: "Cancelar no fim do período" })).toBeEnabled();
    await user.click(janela.getByRole("radio", { name: /^Agora/ }));
    expect(janela.getByRole("checkbox")).not.toBeChecked();
    expect(janela.getByRole("button", { name: "Cancelar agora" })).toBeDisabled();
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });

  it.each(["Voltar", "Escape"])("fechar com %s e reabrir desmarca o cancelamento imediato", async (comoFechar) => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Cancelar assinatura…" }));
    const janela = within(screen.getByRole("dialog"));
    await user.type(janela.getByRole("textbox"), MOTIVO);
    await user.click(janela.getByRole("radio", { name: /^Agora/ }));
    await user.click(janela.getByRole("checkbox"));
    if (comoFechar === "Escape") await user.keyboard("{Escape}");
    else await user.click(janela.getByRole("button", { name: "Voltar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Cancelar assinatura…" }));
    const reaberta = within(screen.getByRole("dialog"));
    expect(reaberta.getByRole("radio", { name: /^No fim do período/ })).toBeChecked();
    await user.click(reaberta.getByRole("radio", { name: /^Agora/ }));
    expect(reaberta.getByRole("checkbox")).not.toBeChecked();
    await user.type(reaberta.getByRole("textbox"), MOTIVO);
    expect(reaberta.getByRole("button", { name: "Cancelar agora" })).toBeDisabled();
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });

  it("manter assinatura continua sem caixa nem escolha de período", async () => {
    const user = userEvent.setup();
    montar(true);
    await user.click(screen.getByRole("button", { name: "Manter assinatura…" }));
    const janela = within(screen.getByRole("dialog", { name: `Manter a assinatura de ${NOME}?` }));
    expect(janela.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(janela.queryByRole("radio")).not.toBeInTheDocument();
    await user.type(janela.getByRole("textbox"), MOTIVO);
    await user.click(janela.getByRole("button", { name: "Manter assinatura" }));
    expect(manterAssinatura).toHaveBeenCalledExactlyOnceWith(ID, MOTIVO);
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });
});

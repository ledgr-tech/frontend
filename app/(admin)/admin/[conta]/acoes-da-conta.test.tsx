import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AcoesDaConta } from "./acoes-da-conta";

const { agirNaConta, refresh } = vi.hoisted(() => ({ agirNaConta: vi.fn(), refresh: vi.fn() }));
vi.mock("../acoes", () => ({ agirNaConta }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ID = "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20";
const NOME = "Empresa de teste";
const MOTIVO = "Solicitação de teste do operador";

beforeEach(() => {
  agirNaConta.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
});

describe("AcoesDaConta", () => {
  it("só inativa com motivo e confirmação da conta, chamando a action uma vez", async () => {
    const user = userEvent.setup();
    render(<AcoesDaConta id={ID} nome={NOME} inativa={false} piloto={false} />);
    await user.click(screen.getByRole("button", { name: "Inativar conta" }));
    const janela = within(screen.getByRole("dialog", { name: `Inativar ${NOME}?` }));
    const enviar = janela.getByRole("button", { name: "Inativar conta" });
    const motivo = janela.getByRole("textbox", { name: "Motivo (fica no histórico da conta)" });
    const confirmar = janela.getByRole("checkbox", { name: `Confirmo a inativação de ${NOME}.` });
    expect(confirmar).toBeRequired();
    expect(enviar).toBeDisabled();

    await user.type(motivo, MOTIVO);
    expect(enviar).toBeDisabled();
    await user.click(enviar);
    expect(agirNaConta).not.toHaveBeenCalled();
    await user.click(confirmar);
    expect(enviar).toBeEnabled();
    await user.clear(motivo);
    expect(enviar).toBeDisabled();
    await user.type(motivo, MOTIVO);
    await user.click(enviar);

    expect(agirNaConta).toHaveBeenCalledExactlyOnceWith(ID, "inativar", MOTIVO);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    { botao: "Reativar conta", acao: "reativar", inativa: true, piloto: false },
    { botao: "Marcar como piloto", acao: "piloto-ligar", inativa: false, piloto: false },
    { botao: "Desmarcar piloto", acao: "piloto-desligar", inativa: false, piloto: true },
  ])("$botao continua exigindo só o motivo", async ({ botao, acao, inativa, piloto }) => {
    const user = userEvent.setup();
    render(<AcoesDaConta id={ID} nome={NOME} inativa={inativa} piloto={piloto} />);
    await user.click(screen.getByRole("button", { name: botao }));
    const janela = within(screen.getByRole("dialog"));
    expect(janela.queryByRole("checkbox")).not.toBeInTheDocument();
    const enviar = janela.getByRole("button", { name: botao });
    expect(enviar).toBeDisabled();
    await user.type(janela.getByRole("textbox"), MOTIVO);
    expect(enviar).toBeEnabled();
    await user.click(enviar);
    expect(agirNaConta).toHaveBeenCalledExactlyOnceWith(ID, acao, MOTIVO);
  });

  it.each(["Cancelar", "Escape"])("fechar com %s e abrir de novo desmarca a confirmação", async (comoFechar) => {
    const user = userEvent.setup();
    render(<AcoesDaConta id={ID} nome={NOME} inativa={false} piloto={false} />);
    await user.click(screen.getByRole("button", { name: "Inativar conta" }));
    const janela = within(screen.getByRole("dialog"));
    await user.type(janela.getByRole("textbox"), MOTIVO);
    await user.click(janela.getByRole("checkbox"));
    if (comoFechar === "Escape") await user.keyboard("{Escape}");
    else await user.click(janela.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Inativar conta" }));
    const reaberta = within(screen.getByRole("dialog"));
    expect(reaberta.getByRole("checkbox")).not.toBeChecked();
    await user.type(reaberta.getByRole("textbox"), MOTIVO);
    expect(reaberta.getByRole("button", { name: "Inativar conta" })).toBeDisabled();
    expect(agirNaConta).not.toHaveBeenCalled();
  });
});

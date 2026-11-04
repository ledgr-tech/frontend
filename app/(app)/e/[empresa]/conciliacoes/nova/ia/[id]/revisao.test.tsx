import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Revisao } from "./revisao";
import type { Rascunho } from "../acoes";

const acoes = vi.hoisted(() => ({
  acrescentar: vi.fn(),
  carregar: vi.fn(),
  confirmar: vi.fn(),
  corrigir: vi.fn(),
  descartar: vi.fn(),
  remover: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/roteador", () => ({ useRoteador: () => ({ push: acoes.push }) }));
vi.mock("../acoes", () => ({
  acrescentarLinhaAoRascunho: acoes.acrescentar,
  carregarRascunho: acoes.carregar,
  confirmarImportacao: acoes.confirmar,
  corrigirLinhaDoRascunho: acoes.corrigir,
  descartarImportacao: acoes.descartar,
  removerLinhaDoRascunho: acoes.remover,
}));

const LINHA = { id: "linha-1", numero: 1, data: "2026-10-01", descricao: "Recebimento inicial", valor: "200" };
const INICIAL: Rascunho = {
  id: "importacao-1",
  total: 2,
  itens: [LINHA, { id: "linha-2", numero: 2, data: "2026-10-15", descricao: "Recebimento mantido", valor: "100" }],
  resumo: {
    quantidade: 2,
    totalEntradas: "300",
    totalSaidas: "0",
    periodoInicio: "2026-10-01",
    periodoFim: "2026-10-15",
    expiraEm: "2026-11-10T12:00:00Z",
  },
};
const ATUALIZADO: Rascunho = {
  ...INICIAL,
  total: 1,
  itens: [INICIAL.itens[1]],
  resumo: { ...INICIAL.resumo, quantidade: 1, totalEntradas: "100", periodoInicio: "2026-10-15" },
};

function confirmar() {
  return resumo().getByRole("button", { name: /^Confirmar/ });
}

function resumo() {
  return within(screen.getByRole("complementary", { name: "Resumo do rascunho" }));
}

/** O ícone só pede a confirmação na própria linha; quem apaga é o "Remover" dela. */
async function removerLinha1(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Remover linha 1" }));
  await user.click(screen.getByRole("button", { name: "Remover de vez a linha 1" }));
}

describe("Revisao da importação via IA", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    acoes.carregar.mockResolvedValue({ ok: true, dados: ATUALIZADO });
    acoes.remover.mockResolvedValue({ ok: true, dados: null });
    acoes.confirmar.mockResolvedValue({ ok: true, dados: { extratoId: "extrato-1" } });
  });

  it("impede confirmar enquanto uma correção está aberta e libera depois de salvar", async () => {
    const user = userEvent.setup();
    acoes.corrigir.mockResolvedValue({ ok: true, dados: { linha: { ...LINHA, valor: "150" }, resumo: { ...INICIAL.resumo, totalEntradas: "250" } } });
    render(<Revisao inicial={INICIAL} />);

    await user.click(screen.getByRole("button", { name: "Corrigir linha 1" }));
    await user.clear(screen.getByRole("textbox", { name: "Valor (linha 1)" }));
    await user.type(screen.getByRole("textbox", { name: "Valor (linha 1)" }), "150");
    expect(confirmar()).toBeDisabled();
    await user.click(confirmar());
    expect(acoes.confirmar).not.toHaveBeenCalled();
    expect(resumo().getByText("Salve ou cancele a edição da linha antes de confirmar a importação.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(confirmar()).toBeEnabled();
    await user.click(confirmar());
    expect(acoes.confirmar).toHaveBeenCalledWith(INICIAL.id);
  });

  it("impede confirmar uma linha nova não salva e libera ao cancelar", async () => {
    const user = userEvent.setup();
    render(<Revisao inicial={INICIAL} />);

    await user.click(screen.getByRole("button", { name: "Acrescentar linha" }));
    await user.type(screen.getByRole("textbox", { name: "Valor (nova linha)" }), "50");
    expect(confirmar()).toBeDisabled();
    await user.click(confirmar());
    expect(acoes.confirmar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(confirmar()).toBeEnabled();
    expect(acoes.acrescentar).not.toHaveBeenCalled();
  });

  it("mantém a confirmação bloqueada se o salvamento da correção falha", async () => {
    const user = userEvent.setup();
    acoes.corrigir.mockResolvedValue({ ok: false, erro: "O valor precisa ser um número." });
    render(<Revisao inicial={INICIAL} />);

    await user.click(screen.getByRole("button", { name: "Corrigir linha 1" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O valor precisa ser um número.");
    expect(confirmar()).toBeDisabled();
  });

  it("não deixa cancelar a correção enquanto ela está sendo salva", async () => {
    // cancelar no meio só esconderia a correção, que o backend grava mesmo assim
    const user = userEvent.setup();
    let terminar!: (resultado: unknown) => void;
    acoes.corrigir.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    render(<Revisao inicial={INICIAL} />);

    await user.click(screen.getByRole("button", { name: "Corrigir linha 1" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    terminar({ ok: true, dados: { linha: { ...LINHA, valor: "150" }, resumo: INICIAL.resumo } });
    expect(await screen.findByText(/R\$\s*150,00/)).toBeVisible();
  });

  it("pede confirmação na própria linha antes de remover, e Manter desiste", async () => {
    const user = userEvent.setup();
    render(<Revisao inicial={INICIAL} />);

    await user.click(screen.getByRole("button", { name: "Remover linha 1" }));
    expect(acoes.remover).not.toHaveBeenCalled();
    // o ícone saiu da tela: o foco vai para o que não apaga nada, então Enter duas vezes não remove
    expect(screen.getByRole("button", { name: "Manter linha 1" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Manter linha 1" }));
    expect(acoes.remover).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remover linha 1" })).toBeInTheDocument();
    expect(screen.getByText("Recebimento inicial")).toBeVisible();
  });

  it("relê entradas, saídas e período completos depois de excluir uma linha", async () => {
    const user = userEvent.setup();
    render(<Revisao inicial={INICIAL} />);

    await removerLinha1(user);
    expect(acoes.remover).toHaveBeenCalledWith(INICIAL.id, LINHA.id);
    expect(acoes.carregar).toHaveBeenCalledWith(INICIAL.id);
    expect(screen.queryByText("Recebimento inicial")).not.toBeInTheDocument();
    expect(resumo().getByText(/R\$\s*100,00/)).toBeVisible();
    expect(resumo().getByText("15/10/2026 a 15/10/2026")).toBeVisible();
    expect(confirmar()).toHaveAccessibleName("Confirmar 1 lançamento");
  });

  it("usa o resumo global quando há mais linhas do que as carregadas", async () => {
    // A página carregada é uma amostra: os totais vêm do servidor, não da soma dessas linhas.
    const itens = [
      { ...LINHA, valor: "-1" },
      { ...LINHA, id: "linha-2", numero: 2, data: "2026-10-02", valor: "-1" },
    ];
    const inicial = { ...INICIAL, total: 1002, itens, resumo: { ...INICIAL.resumo, quantidade: 1002, totalEntradas: "9000", totalSaidas: "4500" } };
    acoes.carregar.mockResolvedValue({ ok: true, dados: { ...inicial, total: 1001, itens: itens.slice(1), resumo: { ...inicial.resumo, quantidade: 1001, totalEntradas: "9000", totalSaidas: "4499", periodoInicio: "2026-10-02" } } });
    render(<Revisao inicial={inicial} />);

    fireEvent.click(screen.getByLabelText("Remover linha 1", { exact: true }));
    fireEvent.click(screen.getByLabelText("Remover de vez a linha 1"));
    expect(await resumo().findByText(/R\$\s*4\.499,00/)).toBeVisible();
    expect(resumo().getByText(/R\$\s*9\.000,00/)).toBeVisible();
    expect(resumo().getByText("02/10/2026 a 15/10/2026")).toBeVisible();
    expect(confirmar()).toHaveAccessibleName("Confirmar 1001 lançamentos");
  });

  it("mantém linha e resumo se a exclusão falha", async () => {
    const user = userEvent.setup();
    acoes.remover.mockResolvedValue({ ok: false, erro: "Não foi possível remover." });
    render(<Revisao inicial={INICIAL} />);

    await removerLinha1(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível remover.");
    expect(screen.getByText("Recebimento inicial")).toBeVisible();
    expect(resumo().getByText(/R\$\s*300,00/)).toBeVisible();
    expect(acoes.carregar).not.toHaveBeenCalled();
    expect(confirmar()).toBeEnabled();
  });

  it.each(["resposta", "rede"])("bloqueia confirmação e permite recuperar só o resumo após falha de %s na releitura", async (falha) => {
    const user = userEvent.setup();
    if (falha === "resposta") acoes.carregar.mockResolvedValueOnce({ ok: false, erro: "Servidor indisponível." });
    else acoes.carregar.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<Revisao inicial={INICIAL} />);

    await removerLinha1(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("A linha foi removida, mas não foi possível atualizar o resumo.");
    expect(screen.queryByText("Recebimento inicial")).not.toBeInTheDocument();
    expect(confirmar()).toBeDisabled();
    expect(resumo().queryByText(/R\$\s*300,00/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atualizar resumo" }));
    expect(confirmar()).toBeEnabled();
    expect(resumo().getByText(/R\$\s*100,00/)).toBeVisible();
    expect(acoes.carregar).toHaveBeenCalledTimes(2);
    expect(acoes.remover).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

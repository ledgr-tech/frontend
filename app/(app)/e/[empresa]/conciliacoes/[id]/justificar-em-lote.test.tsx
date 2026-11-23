import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JustificarEmLote, textoDoLote } from "./justificar-em-lote";

describe("JustificarEmLote", () => {
  it("abre o formulário com o foco no campo e manda o texto aparado", async () => {
    const onJustificar = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(<JustificarEmLote quantidade={3} jaJustificadas={0} onJustificar={onJustificar} />);

    await user.click(screen.getByRole("button", { name: "Justificar as 3 linhas selecionadas" }));
    const campo = screen.getByRole("textbox", { name: "Motivo da justificativa" });
    expect(campo).toHaveFocus();
    expect(campo).toHaveAttribute("maxlength", "1000");
    expect(screen.getByText(/Fica no registro com o seu nome e o horário/)).toBeInTheDocument();
    await user.type(campo, "  Juros do mês.  ");
    await user.click(screen.getByRole("button", { name: "Justificar" }));

    expect(onJustificar).toHaveBeenCalledWith("Juros do mês.");
    expect(screen.getByRole("button", { name: "Justificar as 3 linhas selecionadas" })).toBeInTheDocument();
  });

  it("uma linha tem o rótulo no singular", () => {
    render(<JustificarEmLote quantidade={1} jaJustificadas={0} onJustificar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Justificar a linha selecionada" })).toBeInTheDocument();
  });

  it("vazio não chama o backend", async () => {
    const onJustificar = vi.fn();
    const user = userEvent.setup();
    render(<JustificarEmLote quantidade={2} jaJustificadas={0} onJustificar={onJustificar} />);

    await user.click(screen.getByRole("button", { name: "Justificar as 2 linhas selecionadas" }));
    await user.type(screen.getByRole("textbox", { name: "Motivo da justificativa" }), "   ");
    await user.click(screen.getByRole("button", { name: "Justificar" }));

    expect(onJustificar).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Escreva o motivo da justificativa.");
  });

  it("avisa quantas selecionadas já têm justificativa", async () => {
    const user = userEvent.setup();
    render(<JustificarEmLote quantidade={4} jaJustificadas={2} onJustificar={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Justificar as 4 linhas selecionadas" }));
    expect(screen.getByText(/2 das selecionadas já têm justificativa; a nova substitui a de antes\./)).toBeInTheDocument();
  });

  it("o duplo clique manda uma vez só", async () => {
    let soltar!: (falha: string | null) => void;
    const onJustificar = vi.fn(() => new Promise<string | null>((resolver) => (soltar = resolver)));
    const user = userEvent.setup();
    render(<JustificarEmLote quantidade={2} jaJustificadas={0} onJustificar={onJustificar} />);

    await user.click(screen.getByRole("button", { name: "Justificar as 2 linhas selecionadas" }));
    await user.type(screen.getByRole("textbox", { name: "Motivo da justificativa" }), "Motivo.");
    const enviar = screen.getByRole("button", { name: "Justificar" });
    await user.dblClick(enviar);
    soltar(null);

    expect(onJustificar).toHaveBeenCalledTimes(1);
  });

  it("mostra o erro e mantém o texto; a action que lança vira falta de servidor", async () => {
    const onJustificar = vi.fn().mockResolvedValueOnce("Este mês está fechado.").mockRejectedValueOnce(new Error("rede"));
    const user = userEvent.setup();
    render(<JustificarEmLote quantidade={2} jaJustificadas={0} onJustificar={onJustificar} />);

    await user.click(screen.getByRole("button", { name: "Justificar as 2 linhas selecionadas" }));
    const campo = screen.getByRole("textbox", { name: "Motivo da justificativa" });
    await user.type(campo, "Motivo.");
    await user.click(screen.getByRole("button", { name: "Justificar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Este mês está fechado.");
    expect(campo).toHaveValue("Motivo.");

    await user.click(screen.getByRole("button", { name: "Justificar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível falar com o servidor");
  });

  it("cancelar fecha sem mandar e devolve o foco ao botão", async () => {
    const onJustificar = vi.fn();
    const user = userEvent.setup();
    render(<JustificarEmLote quantidade={2} jaJustificadas={0} onJustificar={onJustificar} />);

    await user.click(screen.getByRole("button", { name: "Justificar as 2 linhas selecionadas" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onJustificar).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Justificar as 2 linhas selecionadas" })).toHaveFocus();
  });

  it("acima do limite o botão desliga e diz o máximo", () => {
    render(<JustificarEmLote quantidade={501} jaJustificadas={0} onJustificar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Justificar as 501 linhas selecionadas" })).toBeDisabled();
    expect(screen.getByText("Selecione no máximo 500 linhas para justificar de uma vez.")).toBeInTheDocument();
  });
});

describe("textoDoLote", () => {
  const nada = { naoEncontrada: 0, naoDiverge: 0, repetida: 0, aprovada: 0 };
  it("diz quantas foram e, das de fora, por quê; a repetida não aparece", () => {
    expect(textoDoLote(3, nada)).toBe("3 linhas justificadas.");
    expect(textoDoLote(1, { ...nada, repetida: 2 })).toBe("1 linha justificada.");
    expect(textoDoLote(3, { ...nada, aprovada: 1, naoDiverge: 1 })).toBe("3 linhas justificadas. 2 ficaram de fora: 1 já aprovada, 1 não diverge mais.");
    expect(textoDoLote(2, { ...nada, naoEncontrada: 1 })).toBe("2 linhas justificadas. 1 ficou de fora: 1 não existe mais nesta rodada.");
    expect(textoDoLote(0, { ...nada, aprovada: 2 })).toBe("Nenhuma linha foi justificada: 2 já aprovadas.");
  });
});

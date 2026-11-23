import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisaoEmLote } from "./decisao-em-lote";

describe("DecisaoEmLote", () => {
  it("bloqueia a rejeição já aberta se a seleção ultrapassa o limite", async () => {
    const onDecidir = vi.fn().mockResolvedValue(null);
    const props = { objeto: { um: "justificativa", varios: "justificativas" }, onDecidir, limite: 500 };
    const user = userEvent.setup();
    const { rerender } = render(<DecisaoEmLote {...props} quantidade={500} />);

    await user.click(screen.getByRole("button", { name: "Rejeitar…" }));
    const motivo = screen.getByRole("textbox", { name: "Motivo da rejeição (opcional)" });
    await user.type(motivo, "Sem comprovante.");
    rerender(<DecisaoEmLote {...props} quantidade={501} />);

    expect(screen.getByRole("button", { name: "Rejeitar as 501 justificativas" })).toBeDisabled();
    fireEvent.submit(motivo.closest("form")!);
    expect(onDecidir).not.toHaveBeenCalled();

    rerender(<DecisaoEmLote {...props} quantidade={500} />);
    await user.click(screen.getByRole("button", { name: "Rejeitar as 500 justificativas" }));
    expect(onDecidir).toHaveBeenCalledExactlyOnceWith("rejeitar", "Sem comprovante.");
  });
});

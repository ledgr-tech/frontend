import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const consultar = vi.fn();
vi.mock("./acoes", () => ({ consultarRelatorioPublico: (token: string) => consultar(token) }));

import { Visualizador } from "./visualizador";

beforeEach(() => {
  consultar.mockReset();
  window.history.replaceState(null, "", "/relatorio");
});

describe("Visualizador, link que não abre", () => {
  it("sem token, mostra o aviso com saída para o site e sem consultar", async () => {
    render(<Visualizador />);
    expect(await screen.findByRole("heading", { name: "Este link não abre mais." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conhecer o Ledgr" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
    expect(consultar).not.toHaveBeenCalled();
  });

  it("na falha, Tentar de novo consulta outra vez com o mesmo token, que já saiu da barra", async () => {
    window.history.replaceState(null, "", "/relatorio#abc");
    consultar.mockResolvedValueOnce({ ok: false, motivo: "falha" }).mockResolvedValueOnce({ ok: false, motivo: "invalido" });
    render(<Visualizador />);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("heading", { name: "Este link não abre mais." })).toBeInTheDocument();
    expect(consultar.mock.calls).toEqual([["abc"], ["abc"]]);
    expect(window.location.hash).toBe("");
  });
});

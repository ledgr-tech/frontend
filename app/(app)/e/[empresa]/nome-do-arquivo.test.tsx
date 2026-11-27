import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NomeDoArquivo } from "./nome-do-arquivo";

describe("NomeDoArquivo", () => {
  it("keeps a short name whole, in one piece", () => {
    const { container } = render(<NomeDoArquivo nome="banco-setembro.ofx" prefixo="× " />);
    const nome = container.querySelector(".hist-arquivo-nome")!;
    expect(nome.textContent).toBe("× banco-setembro.ofx");
    expect(nome.querySelector(".hist-arquivo-fim")).toBeNull();
  });

  it("keeps the last 14 characters of a long name in view, spaces included, and the whole name for screen readers", () => {
    const longo = "Extrato Itau conta corrente novembro 2026 final.csv";
    const { container } = render(<NomeDoArquivo nome={longo} />);
    const nome = container.querySelector(".hist-arquivo-nome")!;
    expect(nome).toHaveAttribute("title", longo);
    expect(nome.querySelector(".hist-arquivo-fim")?.textContent).toBe("2026 final.csv");
    // o espaço da emenda fica no fim do começo; o CSS (white-space: pre) o mantém na tela
    expect(nome.querySelector(".hist-arquivo-inicio")?.textContent).toBe("Extrato Itau conta corrente novembro ");
    expect(nome.querySelector(".sr-only")?.textContent).toBe(longo);
  });
});

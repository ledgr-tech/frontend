import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransicaoDeTela } from "./transicao-de-tela";

describe("TransicaoDeTela", () => {
  it("renders the screen content (falling back to a plain wrapper where React has no ViewTransition)", () => {
    render(
      <TransicaoDeTela>
        <main>
          <h1>Crie seu acesso.</h1>
        </main>
      </TransicaoDeTela>,
    );
    expect(screen.getByRole("heading", { name: "Crie seu acesso." })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});

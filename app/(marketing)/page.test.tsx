import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

describe("LandingPage", () => {
  it("shows the hero headline and a link into the product", () => {
    render(<LandingPage />);
    expect(
      screen.getByRole("heading", { name: "Pare de conciliar extrato à mão." })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Conciliar meu primeiro extrato" })
    ).toHaveAttribute("href", "/login");
  });

  it("states the golden rule and the pricing model", () => {
    render(<LandingPage />);
    expect(
      screen.getByText("O extrato do banco é sempre a fonte da verdade.")
    ).toBeInTheDocument();
    expect(screen.getByText("Preço fechado, por volume.")).toBeInTheDocument();
  });
});

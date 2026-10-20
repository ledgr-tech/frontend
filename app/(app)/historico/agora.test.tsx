import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgoraDoHistorico } from "./agora";

describe("AgoraDoHistorico", () => {
  it("separa os milhares da contagem de pendências", () => {
    render(<AgoraDoHistorico conciliacao={{ titulo: "Setembro de 2026", quantidade: 1234, href: "/conciliacoes/B" }} />);
    expect(screen.getByRole("link", { name: "1.234 pendências em Setembro de 2026" })).toHaveAttribute("href", "/conciliacoes/B");
  });
});

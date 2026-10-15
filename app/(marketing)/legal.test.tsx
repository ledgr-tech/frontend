import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacidadePage from "./privacidade/page";
import TermosPage from "./termos/page";

describe("Termos e Privacidade", () => {
  it.each([
    ["Política de privacidade", PrivacidadePage],
    ["Termos de uso", TermosPage],
  ])("%s says it is a preliminary version under legal review, with a way to write", (titulo, Pagina) => {
    render(<Pagina />);
    expect(screen.getByRole("heading", { level: 1, name: titulo })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("Em revisão jurídica.");
    // o que depende do jurídico aparece no lugar, não escondido
    expect(screen.getAllByText("Em definição:").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "ledgrtech@gmail.com" })).toBeInTheDocument();
  });

  it("gives the sections the anchors the site footer's LGPD and Segurança links point to", () => {
    render(<PrivacidadePage />);
    expect(screen.getByRole("heading", { name: "Seus direitos" })).toHaveAttribute("id", "direitos");
    expect(screen.getByRole("heading", { name: "Segurança" })).toHaveAttribute("id", "seguranca");
  });
});

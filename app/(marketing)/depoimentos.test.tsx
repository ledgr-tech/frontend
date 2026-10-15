import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Depoimento } from "@/lib/depoimentos";
import { MotionRoot } from "../reveal";
import { Depoimentos } from "./depoimentos";

const COM_NOTA: Depoimento = {
  citacao: "O fechamento que levava a semana inteira agora cabe numa tarde.",
  nome: "Ana Souza",
  cargo: "Responsável financeira",
  empresa: "Comércio Exemplo",
  nota: 4,
};

const SEM_NOTA_NEM_EMPRESA: Depoimento = {
  citacao: "Mando o CSV do relatório para o contador e acabou.",
  nome: "Bruno Lima",
  cargo: "Contador",
};

function renderDepoimentos(depoimentos: Depoimento[]) {
  return render(
    <MotionRoot>
      <Depoimentos depoimentos={depoimentos} />
    </MotionRoot>,
  );
}

const cards = () => screen.getAllByRole("figure");

describe("Depoimentos", () => {
  it("shows each testimonial as a quote signed with the person's name, role and company", () => {
    renderDepoimentos([COM_NOTA, SEM_NOTA_NEM_EMPRESA]);
    expect(cards()).toHaveLength(2);

    const primeiro = within(cards()[0]);
    expect(primeiro.getByText("O fechamento que levava a semana inteira agora cabe numa tarde.").closest("blockquote")).not.toBeNull();
    expect(primeiro.getByText("Ana Souza")).toBeInTheDocument();
    expect(primeiro.getByText("Responsável financeira, Comércio Exemplo")).toBeInTheDocument();
  });

  it("signs with the role alone when there is no company", () => {
    renderDepoimentos([SEM_NOTA_NEM_EMPRESA]);
    const assinatura = cards()[0].querySelector("figcaption")!;
    expect(within(assinatura).getByText("Contador")).toBeInTheDocument();
    expect(assinatura.textContent).not.toMatch(/undefined|,/);
  });

  it("shows the person's initial in the avatar, out of the screen reader, since the name is already there", () => {
    renderDepoimentos([COM_NOTA, SEM_NOTA_NEM_EMPRESA]);
    const avatares = cards().map((card) => card.querySelector(".depoimento-avatar")!);
    expect(avatares.map((avatar) => avatar.textContent)).toEqual(["A", "B"]);
    for (const avatar of avatares) expect(avatar).toHaveAttribute("aria-hidden", "true");
  });

  it("shows stars only for a rating the person really gave, filled up to it and read out as text", () => {
    renderDepoimentos([COM_NOTA, SEM_NOTA_NEM_EMPRESA]);
    const [comNota, semNota] = cards();

    const nota = within(comNota).getByRole("img", { name: "Nota 4 de 5" });
    expect(nota.querySelectorAll(".depoimento-estrela")).toHaveLength(5);
    expect(nota.querySelectorAll(".depoimento-estrela[data-cheia]")).toHaveLength(4);

    expect(within(semNota).queryByRole("img", { name: /^Nota/ })).not.toBeInTheDocument();
    expect(semNota.querySelector(".depoimento-estrela")).toBeNull();
  });

  it("titles the section with the landing's mixed title, a short stretch in the display italic", () => {
    renderDepoimentos([COM_NOTA]);
    const titulo = screen.getByRole("heading", { level: 2, name: "Quem já concilia, conta." });
    expect(titulo).toHaveClass("titulo-misto");
    expect(titulo.querySelector("em")!.textContent).toBe("conta.");
  });

  it("keeps the big quote mark as decoration only", () => {
    renderDepoimentos([COM_NOTA]);
    expect(cards()[0].querySelector(".depoimento-aspas")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing without testimonials, so the page never shows an empty or made-up section", () => {
    const { container } = renderDepoimentos([]);
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Quem já concilia, conta." })).not.toBeInTheDocument();
  });
});

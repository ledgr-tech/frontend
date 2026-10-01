import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import type { Depoimento } from "@/lib/depoimentos";
import LandingPage from "./page";

// a lista real começa vazia e cresce quando os depoimentos chegam: aqui ela é trocada por uma lista
// de teste, para a landing ser conferida com e sem depoimentos
const lista = vi.hoisted(() => ({ depoimentos: [] as Depoimento[] }));
vi.mock("@/lib/depoimentos", () => ({
  get DEPOIMENTOS() {
    return lista.depoimentos;
  },
}));

const UM: Depoimento = {
  citacao: "O fechamento que levava a semana inteira agora cabe numa tarde.",
  nome: "Ana Souza",
  cargo: "Responsável financeira",
  empresa: "Comércio Exemplo",
};

const idsDasSecoes = (container: HTMLElement) => [...container.querySelectorAll("main > section[id]")].map((secao) => secao.id);

describe("LandingPage with testimonials", () => {
  afterEach(() => {
    lista.depoimentos = [];
  });

  it("puts the testimonials between the golden rule and the FAQ, where the design export had them", () => {
    lista.depoimentos = [UM];
    const { container } = render(<LandingPage />);
    const ids = idsDasSecoes(container);
    expect(ids.slice(ids.indexOf("regra"), ids.indexOf("regra") + 3)).toEqual(["regra", "depoimentos", "perguntas"]);
  });

  it("keeps the bands alternating: the dark band takes the golden rule's paper wave, and the FAQ takes its dark one", () => {
    lista.depoimentos = [UM];
    render(<LandingPage />);
    expect(document.getElementById("depoimentos")).toHaveClass("onda", "onda-papel");
    expect(document.getElementById("perguntas")).toHaveClass("onda", "onda-escura");
    expect(document.getElementById("perguntas")).not.toHaveClass("onda-papel");
  });

  it("leaves the page as before while there are no testimonials", () => {
    const { container } = render(<LandingPage />);
    expect(idsDasSecoes(container)).not.toContain("depoimentos");
    expect(document.getElementById("perguntas")).toHaveClass("onda", "onda-papel");
    expect(document.getElementById("perguntas")).not.toHaveClass("onda-escura");
  });
});

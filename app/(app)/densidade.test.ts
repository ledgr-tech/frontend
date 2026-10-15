import { describe, it, expect, beforeEach } from "vitest";
import { aplicarDensidade, densidadeAtual } from "./densidade";

describe("densidade das tabelas", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.densidade;
  });

  it("começa na compacta para quem nunca escolheu", () => {
    expect(densidadeAtual()).toBe("compacta");
  });

  it("respeita quem escolheu a padrão", () => {
    aplicarDensidade("padrao");
    expect(densidadeAtual()).toBe("padrao");
    expect(document.documentElement.dataset.densidade).toBe("padrao");
  });

  it("trata um valor que não é densidade como nenhuma escolha", () => {
    window.localStorage.setItem("ledgr_densidade", "gigante");
    expect(densidadeAtual()).toBe("compacta");
  });
});

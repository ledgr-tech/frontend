import { describe, expect, it } from "vitest";
import { chaveDaSituacao, classeDoSelo, prazoDoTeste } from "./situacao";

const AGORA = Date.parse("2026-10-28T12:00:00Z");

describe("prazoDoTeste", () => {
  it("diz quanto falta e quanto faz", () => {
    expect(prazoDoTeste("2026-11-02T12:00:00Z", AGORA)).toBe("em 5 dias");
    expect(prazoDoTeste("2026-10-20T12:00:00Z", AGORA)).toBe("há 8 dias");
    expect(prazoDoTeste("2026-10-29T12:00:00Z", AGORA)).toBe("em 1 dia");
    expect(prazoDoTeste("2026-10-28T15:00:00Z", AGORA)).toBe("hoje");
  });
});

describe("situação da conta", () => {
  it("uma conta inativa vale inativa, qualquer que seja a situação comercial", () => {
    expect(chaveDaSituacao({ situacao: "ativo", inativa: true })).toBe("inativa");
    expect(chaveDaSituacao({ situacao: "teste", inativa: false })).toBe("teste");
  });

  it("o selo é verde, âmbar, vermelho ou neutro", () => {
    expect(classeDoSelo("ativo")).toBe("selo selo-ok");
    expect(classeDoSelo("teste")).toBe("selo selo-atencao");
    expect(classeDoSelo("teste_encerrado")).toBe("selo selo-risco");
    expect(classeDoSelo("inativa")).toBe("selo selo-risco");
    expect(classeDoSelo("sem_plano")).toBe("selo");
  });
});

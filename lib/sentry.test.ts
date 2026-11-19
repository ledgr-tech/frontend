import { describe, expect, it } from "vitest";
import { semTokenNaTrilha, semTokenNoEvento } from "./sentry";

describe("semTokenNaTrilha", () => {
  it("tira o token do fragmento da navegação e das chamadas", () => {
    const passo = semTokenNaTrilha({
      category: "navigation",
      data: { from: "https://ledgr/redefinir-senha#token=segredo", to: "/redefinir-senha" },
    });
    expect(passo?.data).toEqual({ from: "https://ledgr/redefinir-senha", to: "/redefinir-senha" });
    expect(semTokenNaTrilha({ category: "fetch", data: { url: "/aceitar-convite#token=x" } })?.data?.url).toBe(
      "/aceitar-convite",
    );
  });

  it("não manda o console", () => {
    expect(semTokenNaTrilha({ category: "console", data: { arguments: ["lançamento"] } })).toBeNull();
  });

  it("deixa o resto como está", () => {
    expect(semTokenNaTrilha({ category: "ui.click" })).toEqual({ category: "ui.click" });
  });
});

describe("semTokenNoEvento", () => {
  it("tira o fragmento do endereço do erro", () => {
    expect(semTokenNoEvento({ request: { url: "https://ledgr/confirmar-email#token=y" } }).request?.url).toBe(
      "https://ledgr/confirmar-email",
    );
    expect(semTokenNoEvento({})).toEqual({});
  });
});

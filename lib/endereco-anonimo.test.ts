import { describe, expect, it } from "vitest";
import { enderecoAnonimo } from "./endereco-anonimo";

describe("enderecoAnonimo (S1-21)", () => {
  it("troca cada UUID por [id] e corta a busca e o fragmento", () => {
    expect(
      enderecoAnonimo(
        "https://ledgr.app/e/3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20/conciliacoes/EA0A9F44-D4D2-4D65-93BF-8494EB235A94?pedido=x#token=abc",
      ),
    ).toBe("https://ledgr.app/e/[id]/conciliacoes/[id]");
  });

  it("o token de um link de e-mail nunca sai, nem no fragmento", () => {
    expect(enderecoAnonimo("https://ledgr.app/redefinir-senha#token=segredo")).toBe("https://ledgr.app/redefinir-senha");
  });

  it("endereço sem nada a esconder sai igual, e o que não é URL não sai", () => {
    expect(enderecoAnonimo("https://ledgr.app/precos")).toBe("https://ledgr.app/precos");
    expect(enderecoAnonimo("não é url")).toBeNull();
  });
});

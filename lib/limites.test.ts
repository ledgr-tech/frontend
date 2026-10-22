import { describe, expect, it } from "vitest";
import { adaptarLimites, situacaoDoLimite, textoDoLimite } from "./limites";

describe("adaptarLimites", () => {
  it("lê empresas e usuários do /me; o backend chama de `usados` os usuários, o tipo é um só", () => {
    expect(
      adaptarLimites({ empresas: { usadas: 2, maximo: 3 }, usuarios: { usados: 1, maximo: null } }),
    ).toEqual({ empresas: { usadas: 2, maximo: 3 }, usuarios: { usadas: 1, maximo: null } });
  });

  it.each([undefined, null, {}, { empresas: "x" }, { empresas: { usadas: -1, maximo: 3 } }, { empresas: { usadas: 1, maximo: "3" } }])(
    "sem o campo ou malformado (%j), é null: nada é mostrado",
    (bruto) => {
      expect(adaptarLimites(bruto)).toBeNull();
    },
  );

  it("com só um dos dois válido, o outro vem null", () => {
    expect(adaptarLimites({ empresas: { usadas: 2, maximo: 3 } })).toEqual({ empresas: { usadas: 2, maximo: 3 }, usuarios: null });
    expect(adaptarLimites({ empresas: { usadas: 2, maximo: 3 }, usuarios: { usados: "x", maximo: 1 } })).toEqual({
      empresas: { usadas: 2, maximo: 3 },
      usuarios: null,
    });
  });
});

describe("situacaoDoLimite", () => {
  it.each([
    [{ usadas: 5, maximo: null }, "livre"],
    [{ usadas: 1, maximo: 3 }, "folga"],
    [{ usadas: 2, maximo: 3 }, "perto"],
    [{ usadas: 8, maximo: 10 }, "perto"],
    [{ usadas: 7, maximo: 10 }, "folga"],
    [{ usadas: 3, maximo: 3 }, "no-limite"],
    [{ usadas: 4, maximo: 3 }, "acima"],
  ] as const)("%j é %s", (limite, situacao) => {
    expect(situacaoDoLimite(limite)).toBe(situacao);
  });
});

describe("textoDoLimite", () => {
  it("empresas: nada em folga e em livre", () => {
    expect(textoDoLimite("empresas", { usadas: 1, maximo: 3 })).toBeNull();
    expect(textoDoLimite("empresas", { usadas: 9, maximo: null })).toBeNull();
  });

  it("empresas: perto do limite, no singular e no plural", () => {
    expect(textoDoLimite("empresas", { usadas: 2, maximo: 3 })).toBe("Falta 1 empresa para o limite do plano.");
    expect(textoDoLimite("empresas", { usadas: 8, maximo: 10 })).toBe("Faltam 2 empresas para o limite do plano.");
  });

  it("empresas: no limite e acima dele", () => {
    expect(textoDoLimite("empresas", { usadas: 3, maximo: 3 })).toBe(
      "O plano chegou ao limite de 3 empresas. Para adicionar outra, troque de plano em Assinatura.",
    );
    expect(textoDoLimite("empresas", { usadas: 4, maximo: 3 })).toBe(
      "A conta tem mais empresas (4) do que o plano permite (3). Nada some; só não dá para adicionar.",
    );
  });

  it("usuários: perto, no limite e acima", () => {
    expect(textoDoLimite("usuarios", { usadas: 2, maximo: 3 })).toBe("Falta 1 pessoa para o limite do plano.");
    expect(textoDoLimite("usuarios", { usadas: 3, maximo: 3 })).toBe(
      "O plano chegou ao limite de 3 pessoas, contando os convites pendentes. Para convidar mais, troque de plano em Assinatura.",
    );
    expect(textoDoLimite("usuarios", { usadas: 4, maximo: 3 })).toBe(
      "A conta tem mais pessoas (4) do que o plano permite (3). Ninguém perde o acesso; só não dá para convidar.",
    );
  });
});

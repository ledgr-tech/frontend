import { describe, expect, it } from "vitest";
import { dataDoFiltro, enderecoDaLista, formatarValor } from "./cobranca";

describe("cobrança no painel", () => {
  it("formata centavos na moeda da Stripe", () => {
    expect(formatarValor(14900, "brl").replace(/\s/g, " ")).toBe("R$ 149,00");
  });

  it("só aceita data AAAA-MM-DD no filtro", () => {
    expect(dataDoFiltro("2026-11-03")).toBe("2026-11-03");
    expect(dataDoFiltro("03/11/2026")).toBeUndefined();
    expect(dataDoFiltro(undefined)).toBeUndefined();
  });

  it("monta o endereço sem filtros vazios nem a página 1", () => {
    expect(enderecoDaLista("/admin/pagamentos", { status: "falhou", desde: "", pagina: "3" }, 1)).toBe("/admin/pagamentos?status=falhou");
    expect(enderecoDaLista("/admin/pagamentos", {}, 2)).toBe("/admin/pagamentos?pagina=2");
  });
});

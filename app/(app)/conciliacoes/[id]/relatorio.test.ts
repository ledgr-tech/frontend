import { describe, it, expect } from "vitest";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import { porCategoria } from "./relatorio";

function linha(id: string, status: StatusLinha, valorBanco: number | null, valorSistema: number | null): LinhaComparacao {
  return { id, descricao: id, data: "04/09", valorBanco, valorSistema, status, explicacao: null, historico: [] };
}

describe("porCategoria", () => {
  it("conta as cinco categorias na régua de gravidade, mesmo as vazias", () => {
    const categorias = porCategoria([
      linha("batida", "match_exato", 100, 100),
      linha("tarifa", "tarifa_bancaria", -12.9, null),
      linha("juros", "divergente_valor", 12640, 12604),
      linha("orfa", "sem_correspondencia", null, 3150),
      linha("outra-orfa", "sem_correspondencia", -80, null),
      linha("dia", "divergente_data", 500, 500),
    ]);

    expect(categorias.map(({ status, quantidade, valor }) => [status, quantidade, valor])).toEqual([
      ["divergente_valor", 1, 36],
      ["duplicado", 0, 0],
      // mesmo valor em outra data: está tudo lá, nada em aberto
      ["divergente_data", 1, 0],
      // débito conta pelo tamanho, não desconta do crédito
      ["sem_correspondencia", 2, 3230],
      ["tarifa_bancaria", 1, 12.9],
    ]);
    expect(categorias[0]).toMatchObject({ rotulo: "Valor diverge na mesma data", tom: "risco" });
  });
});

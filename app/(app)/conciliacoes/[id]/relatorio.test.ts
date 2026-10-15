import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import type { LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import { porCategoria, Relatorio } from "./relatorio";

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

describe("Relatorio", () => {
  // o total do topo, com o espaço do "R$" normalizado
  function total(linhas: LinhaComparacao[], justificadas?: number): string | undefined {
    render(createElement(Relatorio, { linhas, justificadas, ativa: null, onEscolher: () => {} }));
    return screen.getByText(/revisão/).textContent?.replace(/\s/g, " ");
  }

  it("conta as justificadas à parte do que pede revisão", () => {
    const linhas = [linha("juros", "divergente_valor", 12640, 12604), linha("orfa", "sem_correspondencia", null, 3150)];
    expect(total(linhas, 1)).toBe("2 linhas pedem revisão · R$ 3.186 em aberto · 1 justificada");
  });

  it("com tudo justificado, ainda diz quantas são", () => {
    expect(total([linha("batida", "match_exato", 100, 100)], 2)).toBe("Nenhuma linha pede revisão · 2 justificadas");
  });

  it("sem justificadas, o total fica como antes", () => {
    expect(total([linha("juros", "divergente_valor", 12640, 12604)])).toBe("1 linha pede revisão · R$ 36 em aberto");
  });
});

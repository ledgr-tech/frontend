import { describe, it, expect } from "vitest";
import type { Conciliacao, LinhaComparacao, StatusLinha } from "@/lib/mock-data";
import { pendencias } from "./pendencias";

function linha(
  id: string,
  status: StatusLinha,
  valorBanco: number | null,
  valorSistema: number | null,
): LinhaComparacao {
  return {
    id,
    descricao: `Lançamento ${id}`,
    data: "04/09",
    dataISO: "2026-09-04",
    valorBanco,
    valorSistema,
    status,
    explicacao: null,
    historico: [],
  };
}

function conciliacao(linhas: LinhaComparacao[]): Conciliacao {
  return { id: "banco-1", mes: "Setembro/2026", status: "em_andamento", linhas };
}

describe("pendencias", () => {
  it("has nothing to list when every line is settled", () => {
    expect(
      pendencias(
        conciliacao([
          linha("a", "match_exato", 100, 100),
          linha("b", "match_tolerancia", 250, 250),
        ]),
      ),
    ).toEqual([]);
  });

  it("groups the open lines by what the backend found, riskiest first", () => {
    const grupos = pendencias(
      conciliacao([
        linha("ok", "match_exato", 50, 50),
        linha("tarifa", "tarifa_bancaria", -45, null),
        linha("orfa-banco-pequena", "sem_correspondencia", null, -640),
        linha("orfa-1", "sem_correspondencia", 4180, null),
        linha("valor", "divergente_valor", -12640, -12604),
        linha("orfa-2", "sem_correspondencia", 980, null),
      ]),
    );

    // terracota (custa dinheiro) antes de ouro (incompleto), neutro por último; no
    // mesmo tom, o que deixa mais dinheiro em aberto vem antes
    expect(grupos).toEqual([
      {
        rotulo: "Valor diverge na mesma data",
        tom: "risco",
        quantidade: 1,
        valor: 36,
        href: "/conciliacoes/banco-1/valor",
      },
      {
        rotulo: "Sem correspondência no sistema",
        tom: "atencao",
        quantidade: 2,
        valor: 5160,
        href: "/conciliacoes/banco-1/orfa-1",
      },
      {
        rotulo: "Sem correspondência no banco",
        tom: "atencao",
        quantidade: 1,
        valor: 640,
        href: "/conciliacoes/banco-1/orfa-banco-pequena",
      },
      {
        rotulo: "Tarifa bancária",
        tom: "neutro",
        quantidade: 1,
        valor: 45,
        href: "/conciliacoes/banco-1/tarifa",
      },
    ]);
  });
});

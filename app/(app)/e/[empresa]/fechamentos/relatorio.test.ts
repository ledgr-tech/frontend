import { describe, expect, it } from "vitest";
import type { Fechamento, ResumoDoFechamento } from "@/lib/adaptadores";
import type { Conciliacao, LinhaComparacao } from "@/lib/mock-data";
import { montarRelatorio } from "./relatorio";

function fechamento(parcial: Partial<Fechamento> = {}): Fechamento {
  return {
    competencia: "2026-09",
    estado: "fechado",
    ressalva: null,
    fechadoPor: "Maria Financeiro",
    fechadoEm: "2026-10-06T15:20:00Z",
    reabertoPor: null,
    reabertoEm: null,
    ...parcial,
  };
}

function resumo(parcial: Partial<ResumoDoFechamento> = {}): ResumoDoFechamento {
  return {
    pares: [
      {
        extratoBancoId: "b-1",
        extratoSistemaId: "s-1",
        rodada: 2,
        arquivoBanco: "extrato-092026.ofx",
        arquivoSistema: "razao-092026.csv",
      },
    ],
    contagens: {
      total: 120,
      match_exato: 100,
      match_tolerancia: 12,
      divergente_valor: 3,
      duplicado: 1,
      divergente_data: 2,
      sem_correspondencia: 1,
      tarifa_bancaria: 1,
    },
    justificadas: 6,
    pendentes: 2,
    linhasNaoLidas: 0,
    valorEmAberto: 1234.5,
    ...parcial,
  };
}

function linha(parcial: Partial<LinhaComparacao>): LinhaComparacao {
  return {
    id: "l",
    descricao: "Boleto Aço Norte",
    data: "04/09",
    dataISO: "2026-09-04",
    valorBanco: -12640,
    valorSistema: -12604,
    status: "divergente_valor",
    decisao: null,
    explicacao: null,
    historico: [],
    ...parcial,
  };
}

function conciliacao(linhas: LinhaComparacao[]): Conciliacao {
  return { id: "b-1", extratoSistemaId: "s-1", mes: "Setembro/2026", status: "fechada", linhas };
}

const EMPRESA = { razaoSocial: "Telha Certa Ltda", cnpj: "12345678000195" };

describe("montarRelatorio", () => {
  it("abre com a empresa, a competência e quem fechou", () => {
    const relatorio = montarRelatorio({ fechamento: fechamento(), resumo: resumo(), empresa: EMPRESA, conciliacoes: [] });

    expect(relatorio).toMatchObject({
      titulo: "Setembro de 2026",
      empresa: "Telha Certa Ltda",
      cnpj: "12.345.678/0001-95",
      situacao: "Fechado",
      fechadoPor: "Maria Financeiro",
      ressalva: null,
    });
  });

  it("fechado com ressalva leva o texto dela", () => {
    const relatorio = montarRelatorio({
      fechamento: fechamento({ ressalva: "Tarifa de setembro em análise com o banco." }),
      resumo: resumo(),
      empresa: EMPRESA,
      conciliacoes: [],
    });

    expect(relatorio.situacao).toBe("Fechado com ressalva");
    expect(relatorio.ressalva).toBe("Tarifa de setembro em análise com o banco.");
  });

  it("usa os números congelados no fechamento, e as cinco categorias sempre na mesma ordem", () => {
    const relatorio = montarRelatorio({ fechamento: fechamento(), resumo: resumo(), empresa: EMPRESA, conciliacoes: [] });

    expect(relatorio).toMatchObject({ total: 120, conciliadas: 112, justificadas: 6, pendentes: 2, valorEmAberto: 1234.5 });
    expect(relatorio.categorias.map((c) => [c.status, c.quantidade])).toEqual([
      ["divergente_valor", 3],
      ["duplicado", 1],
      ["divergente_data", 2],
      ["sem_correspondencia", 1],
      ["tarifa_bancaria", 1],
    ]);
  });

  it("separa, em cada par, as linhas justificadas das que ficaram pendentes", () => {
    const justificada = linha({
      id: "j",
      decisao: {
        tipo: "justificada",
        texto: "Juros cobrados pelo fornecedor.",
        autor: "Maria Financeiro",
        em: "2026-10-05T13:00:00Z",
        rodada: 2,
      },
    });
    const pendente = linha({ id: "p", descricao: "Tarifa avulsa", status: "tarifa_bancaria", valorSistema: null });
    // conferida não basta: continua pedindo decisão
    const conferida = linha({
      id: "c",
      decisao: { tipo: "conferida", texto: null, autor: "Maria Financeiro", em: "2026-10-05T13:00:00Z", rodada: 2 },
    });
    const batida = linha({ id: "b", status: "match_exato", valorSistema: -12640 });

    const relatorio = montarRelatorio({
      fechamento: fechamento(),
      resumo: resumo(),
      empresa: EMPRESA,
      conciliacoes: [{ conciliacao: conciliacao([justificada, pendente, conferida, batida]), truncada: false }],
    });

    const [par] = relatorio.pares;
    expect(par).toMatchObject({ arquivoBanco: "extrato-092026.ofx", arquivoSistema: "razao-092026.csv", rodada: 2 });
    expect(par.justificadas).toEqual([
      {
        data: "04/09/2026",
        descricao: "Boleto Aço Norte",
        valorBanco: -12640,
        valorSistema: -12604,
        status: "Valor diverge",
        justificativa: "Juros cobrados pelo fornecedor.",
        decididoPor: "Maria Financeiro",
        decididoEm: "2026-10-05T13:00:00Z",
      },
    ]);
    expect(par.pendentes?.map((l) => l.descricao)).toEqual(["Tarifa avulsa", "Boleto Aço Norte"]);
  });

  it("par que não carregou fica sem linhas, sem esconder o par", () => {
    const relatorio = montarRelatorio({ fechamento: fechamento(), resumo: resumo(), empresa: EMPRESA, conciliacoes: [null] });

    expect(relatorio.pares[0]).toMatchObject({ arquivoBanco: "extrato-092026.ofx", justificadas: null, pendentes: null });
  });

  it("avisa quando o backend não mandou todas as linhas do par", () => {
    const relatorio = montarRelatorio({
      fechamento: fechamento(),
      resumo: resumo(),
      empresa: EMPRESA,
      conciliacoes: [{ conciliacao: conciliacao([]), truncada: true }],
    });

    expect(relatorio.pares[0].truncada).toBe(true);
  });

  it("sem a empresa (GET /me falhou), deixa os campos vazios em vez de inventar", () => {
    const relatorio = montarRelatorio({
      fechamento: fechamento(),
      resumo: resumo(),
      empresa: { razaoSocial: "", cnpj: "" },
      conciliacoes: [],
    });

    expect(relatorio).toMatchObject({ empresa: "", cnpj: "" });
  });
});

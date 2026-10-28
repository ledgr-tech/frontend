import { describe, expect, it } from "vitest";
import { adaptarRelatorioPublico, type RelatorioPublicoAPI } from "./publico";

const base: RelatorioPublicoAPI = {
  empresa: { razao_social: "Padaria Ltda", cnpj: "11222333000181" },
  competencia: "2026-09",
  situacao: "fechado_com_ressalva",
  fechado_em: "2026-10-05T12:00:00Z",
  fechado_por: "Ana",
  ressalva: "Falta um extrato",
  resumo: { total: 10, conciliadas: 8, justificadas: 1, pendentes: 1, linhas_nao_lidas: 0, valor_em_aberto: "12.50", categorias: { duplicado: 1 } },
  pares: [
    {
      arquivo_banco: "b.ofx",
      arquivo_sistema: "s.csv",
      rodada: 1,
      justificadas: [
        { data: "2026-09-04", descricao: "Tarifa", valor_banco: "-9.90", valor_sistema: null, situacao: "tarifa_bancaria", justificativa: "Cobrança do banco", justificada_por: "Ana", justificada_em: "2026-10-01T10:00:00Z" },
      ],
      pendentes: [],
      truncada: false,
    },
  ],
  link: { expira_em: "2026-11-05T00:00:00Z" },
};

describe("adaptarRelatorioPublico", () => {
  it("vira o mesmo relatório da página do app", () => {
    const r = adaptarRelatorioPublico(base);
    expect(r.situacao).toBe("Fechado com ressalva");
    expect(r.titulo).toBe("Setembro de 2026");
    expect(r.valorEmAberto).toBe(12.5);
    expect(r.categorias).toHaveLength(5);
    expect(r.categorias.find((c) => c.status === "duplicado")?.quantidade).toBe(1);
    expect(r.categorias.find((c) => c.status === "tarifa_bancaria")?.quantidade).toBe(0);
    expect(r.pares[0].justificadas?.[0]).toMatchObject({ data: "04/09/2026", valorBanco: -9.9, valorSistema: null, decididoPor: "Ana" });
  });
});

import { describe, it, expect } from "vitest";
import {
  adaptarAssinatura,
  adaptarPrecos,
  bloqueiaConciliacao,
  cobrancaImediata,
  diasRestantes,
  formatarDiaCurto,
  fraseCurtaDoTeste,
  fraseDoTeste,
  planosDoTeste,
  type Assinatura,
} from "./assinatura";

describe("assinatura", () => {
  it("lê o que o /me manda", () => {
    expect(adaptarAssinatura({ situacao: "teste", plano: "padrao", teste_termina_em: "2026-10-29" })).toEqual({
      situacao: "teste", plano: "padrao", testeTerminaEm: "2026-10-29", fimDoTeste: "2026-10-29T00:00:00-03:00", cobranca: null,
    });
  });

  it("sem situação, ou com uma desconhecida, é ausente: ninguém é bloqueado", () => {
    expect(adaptarAssinatura({})).toBeNull();
    expect(adaptarAssinatura({ situacao: "trial" })).toBeNull();
  });

  it("plano e data inválidos viram null", () => {
    expect(adaptarAssinatura({ situacao: "teste", plano: "ouro", teste_termina_em: "29/10/2026" })).toEqual({
      situacao: "teste", plano: null, testeTerminaEm: null, fimDoTeste: null, cobranca: null,
    });
  });

  it("conta os dias pelo calendário de São Paulo", () => {
    expect(diasRestantes("2026-10-29", new Date("2026-10-15T12:00:00-03:00"))).toBe(14);
    expect(diasRestantes("2026-10-29", new Date("2026-10-29T23:30:00-03:00"))).toBe(0);
    // 01:00 UTC do dia 16 ainda é dia 15 em São Paulo
    expect(diasRestantes("2026-10-29", new Date("2026-10-16T01:00:00Z"))).toBe(14);
    expect(diasRestantes("2026-10-10", new Date("2026-10-15T12:00:00-03:00"))).toBe(0);
  });

  it("escreve o que falta", () => {
    expect(fraseDoTeste(9)).toBe("Teste grátis · faltam 9 dias");
    expect(fraseDoTeste(1)).toBe("Teste grátis · falta 1 dia");
    expect(fraseDoTeste(0)).toBe("Teste grátis · último dia");
    expect(fraseCurtaDoTeste(9)).toBe("Teste · 9 dias");
    expect(fraseCurtaDoTeste(1)).toBe("Teste · 1 dia");
    expect(fraseCurtaDoTeste(0)).toBe("Teste · último dia");
  });

  it("os planos do teste vêm de lib/planos", () => {
    expect(planosDoTeste().map((p) => [p.id, p.nome])).toEqual([
      ["essencial", "Essencial"], ["padrao", "Padrão"], ["avancado", "Avançado"],
    ]);
  });

  describe("o /me do backend #180", () => {
    it("o fim do teste em data e hora vira o dia em São Paulo", () => {
      expect(adaptarAssinatura({ situacao: "teste", plano: null, teste_termina_em: "2026-11-14T13:00:00Z" })).toEqual({
        situacao: "teste", plano: null, testeTerminaEm: "2026-11-14", fimDoTeste: "2026-11-14T13:00:00Z", cobranca: null,
      });
    });

    it("perto da meia-noite UTC, o dia ainda é o anterior em São Paulo", () => {
      expect(adaptarAssinatura({ situacao: "teste", teste_termina_em: "2026-11-14T02:30:00Z" })?.testeTerminaEm).toBe("2026-11-13");
    });

    it("aceita o pagamento pendente e a assinatura encerrada", () => {
      expect(adaptarAssinatura({ situacao: "pagamento_pendente" })?.situacao).toBe("pagamento_pendente");
      expect(adaptarAssinatura({ situacao: "assinatura_encerrada" })?.situacao).toBe("assinatura_encerrada");
      expect(adaptarAssinatura({ situacao: "outra" })).toBeNull();
    });

    it("lê a cobrança da Stripe, com o fim do período no dia de São Paulo", () => {
      const bruto = {
        situacao: "ativo",
        plano: "padrao",
        assinatura: { status: "active", plano: "padrao", periodo: "anual", periodo_atual_fim: "2027-10-31T15:00:00Z", cancelar_no_fim_do_periodo: false },
      };
      expect(adaptarAssinatura(bruto)?.cobranca).toEqual({
        status: "active", plano: "padrao", periodo: "anual", periodoAtualFim: "2027-10-31", cancelaNoFim: false,
      });
    });

    it("uma cobrança malformada vira null, sem quebrar o resto", () => {
      const base = { status: "active", plano: "padrao", periodo: "anual", periodo_atual_fim: null, cancelar_no_fim_do_periodo: true };
      expect(adaptarAssinatura({ situacao: "ativo", assinatura: { ...base, periodo: "bienal" } })?.cobranca).toBeNull();
      expect(adaptarAssinatura({ situacao: "ativo", assinatura: { ...base, plano: "volume" } })?.cobranca).toBeNull();
      expect(adaptarAssinatura({ situacao: "ativo", assinatura: "sim" })?.cobranca).toBeNull();
      // `in` acharia o "constructor" do protótipo
      expect(adaptarAssinatura({ situacao: "ativo", assinatura: { ...base, plano: "constructor" } })?.cobranca).toBeNull();
      expect(adaptarAssinatura({ situacao: "teste", plano: "toString" })?.plano).toBeNull();
      expect(adaptarAssinatura({ situacao: "ativo", assinatura: base })?.cobranca).toEqual({
        status: "active", plano: "padrao", periodo: "anual", periodoAtualFim: null, cancelaNoFim: true,
      });
    });

    it("só o teste encerrado e a assinatura encerrada bloqueiam a conciliação", () => {
      expect(bloqueiaConciliacao("teste_encerrado")).toBe(true);
      expect(bloqueiaConciliacao("assinatura_encerrada")).toBe(true);
      for (const situacao of ["sem_plano", "teste", "ativo", "pagamento_pendente"] as const) {
        expect(bloqueiaConciliacao(situacao)).toBe(false);
      }
    });

    it("a cobrança é na hora fora do teste ou com menos de 48 horas dele", () => {
      const agora = new Date("2026-11-01T12:00:00Z");
      const teste = (fim: string | null): Assinatura => ({ situacao: "teste", plano: null, testeTerminaEm: null, fimDoTeste: fim, cobranca: null });
      expect(cobrancaImediata(teste("2026-11-03T13:00:00Z"), agora)).toBe(false);
      expect(cobrancaImediata(teste("2026-11-03T11:00:00Z"), agora)).toBe(true);
      expect(cobrancaImediata(teste(null), agora)).toBe(true);
      expect(cobrancaImediata({ ...teste("2026-12-01T00:00:00Z"), situacao: "teste_encerrado" }, agora)).toBe(true);
    });

    it("escreve o dia curto, com o ano só fora do ano corrente em São Paulo", () => {
      const agora = new Date("2026-11-03T12:00:00-03:00");
      expect(formatarDiaCurto("2026-12-14", agora)).toBe("14/12");
      expect(formatarDiaCurto("2027-11-03", agora)).toBe("03/11/2027");
      // 31/12 às 22h em São Paulo já é 2027 em UTC: o ano que vale é o de São Paulo
      expect(formatarDiaCurto("2027-01-03", new Date("2026-12-31T22:00:00-03:00"))).toBe("03/01/2027");
      expect(formatarDiaCurto("2026-12-31", new Date("2026-12-31T22:00:00-03:00"))).toBe("31/12");
    });
  });

  describe("os preços da Stripe (GET /assinatura/precos)", () => {
    const item = (plano: string, periodo: string, valor_centavos: number) => ({ plano, periodo, valor_centavos, moeda: "brl" });

    it("formata, divide por mês e calcula o desconto contra o mensal", () => {
      expect(adaptarPrecos([item("essencial", "mensal", 14900), item("essencial", "anual", 152000)])).toEqual([
        { plano: "essencial", periodo: "mensal", centavos: 14900, valor: "R$ 149,00", porMes: null, desconto: null },
        { plano: "essencial", periodo: "anual", centavos: 152000, valor: "R$ 1.520,00", porMes: "R$ 126,67", desconto: 15 },
      ]);
    });

    it("sem o mensal do plano, não há desconto, mas há o valor por mês", () => {
      expect(adaptarPrecos([item("padrao", "anual", 305000)])).toEqual([
        { plano: "padrao", periodo: "anual", centavos: 305000, valor: "R$ 3.050,00", porMes: "R$ 254,17", desconto: null },
      ]);
    });

    it("deixa de fora o que não é preço de plano e devolve null sem nenhum", () => {
      expect(adaptarPrecos([item("volume", "mensal", 1000), item("essencial", "mensal", -1), item("essencial", "bienal", 1000)])).toBeNull();
      expect(adaptarPrecos([])).toBeNull();
      expect(adaptarPrecos({})).toBeNull();
    });
  });
});

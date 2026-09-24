import { describe, it, expect, beforeEach } from "vitest";
import {
  aceitarValorDoBanco,
  ativarRegra,
  criarConciliacao,
  desativarRegra,
  listarConciliacoes,
  listarRegras,
  buscarConciliacao,
  fecharConciliacao,
  formatarMoeda,
} from "./mock-data";

describe("mock-data store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with no conciliações", () => {
    expect(listarConciliacoes()).toEqual([]);
  });

  it("creates a conciliação em_andamento with mock lines", () => {
    const conciliacao = criarConciliacao();
    expect(conciliacao.status).toBe("em_andamento");
    expect(conciliacao.linhas.length).toBeGreaterThan(0);
    expect(listarConciliacoes()).toHaveLength(1);
  });

  it("finds a conciliação by id, or null if it doesn't exist", () => {
    const criada = criarConciliacao();
    expect(buscarConciliacao(criada.id)?.id).toBe(criada.id);
    expect(buscarConciliacao("id-inexistente")).toBeNull();
  });

  it("closes a conciliação, changing its status to fechada", () => {
    const criada = criarConciliacao();
    const fechada = fecharConciliacao(criada.id);
    expect(fechada?.status).toBe("fechada");
    expect(buscarConciliacao(criada.id)?.status).toBe("fechada");
  });

  it("formats currency values in pt-BR", () => {
    const formatado = formatarMoeda(12640);
    expect(formatado).toContain("R$");
    expect(formatado).toContain("12.640,00");
  });

  it("returns empty array when localStorage contains malformed JSON", () => {
    window.localStorage.setItem("ledgr_conciliacoes_v2", "not valid json {]");
    expect(listarConciliacoes()).toEqual([]);
  });
});

describe("aceitarValorDoBanco", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("copies the bank value onto the system side and matches the linha", () => {
    const criada = criarConciliacao();
    const divergente = criada.linhas.find((linha) => linha.status === "divergente_valor")!;

    const atualizada = aceitarValorDoBanco(criada.id, divergente.id);
    const linha = atualizada?.linhas.find((item) => item.id === divergente.id);

    expect(linha?.status).toBe("match_exato");
    expect(linha?.valorSistema).toBe(divergente.valorBanco);
  });

  it("records the decision in the linha history", () => {
    const criada = criarConciliacao();
    const divergente = criada.linhas.find((linha) => linha.status === "divergente_valor")!;
    const antes = divergente.historico.length;

    const atualizada = aceitarValorDoBanco(criada.id, divergente.id);
    const linha = atualizada?.linhas.find((item) => item.id === divergente.id);

    expect(linha?.historico).toHaveLength(antes + 1);
    expect(linha?.historico.at(-1)?.evento).toContain("aceito");
  });

  it("persists the decision", () => {
    const criada = criarConciliacao();
    const divergente = criada.linhas.find((linha) => linha.status === "divergente_valor")!;
    aceitarValorDoBanco(criada.id, divergente.id);

    const relida = buscarConciliacao(criada.id);
    expect(relida?.linhas.find((item) => item.id === divergente.id)?.status).toBe("match_exato");
  });

  it("leaves a linha the bank does not have alone", () => {
    const criada = criarConciliacao();
    const semBanco = criada.linhas.find((linha) => linha.valorBanco === null)!;

    const atualizada = aceitarValorDoBanco(criada.id, semBanco.id);
    const linha = atualizada?.linhas.find((item) => item.id === semBanco.id);

    expect(linha?.status).toBe(semBanco.status);
    expect(linha?.valorSistema).toBe(semBanco.valorSistema);
  });

  it("returns null for an unknown conciliação", () => {
    expect(aceitarValorDoBanco("nao-existe", "lc-1")).toBeNull();
  });
});

describe("regras", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with the two default rules active and the rest suggested", () => {
    const { ativas, sugeridas } = listarRegras();
    expect(ativas).toHaveLength(2);
    expect(sugeridas).toHaveLength(3);
  });

  it("moves a suggestion into the active list and persists it", () => {
    const sugerida = listarRegras().sugeridas[0];
    ativarRegra(sugerida.id);

    const { ativas, sugeridas } = listarRegras();
    expect(ativas.map((regra) => regra.id)).toContain(sugerida.id);
    expect(sugeridas.map((regra) => regra.id)).not.toContain(sugerida.id);
  });

  it("moves an active rule back into the suggestions", () => {
    const ativa = listarRegras().ativas[0];
    desativarRegra(ativa.id);

    const { ativas, sugeridas } = listarRegras();
    expect(ativas.map((regra) => regra.id)).not.toContain(ativa.id);
    expect(sugeridas.map((regra) => regra.id)).toContain(ativa.id);
  });

  it("does not activate the same rule twice", () => {
    const ativa = listarRegras().ativas[0];
    ativarRegra(ativa.id);
    expect(listarRegras().ativas.filter((regra) => regra.id === ativa.id)).toHaveLength(1);
  });

  it("falls back to the defaults when localStorage is malformed", () => {
    window.localStorage.setItem("ledgr_regras_ativas", "not valid json {]");
    expect(listarRegras().ativas).toHaveLength(2);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  aceitarValorDoBanco,
  criarConciliacao,
  listarConciliacoes,
  listarRegras,
  buscarConciliacao,
  fecharConciliacao,
  formatarMoeda,
  registrarDecisaoNoMock,
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

describe("registrarDecisaoNoMock", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T13:12:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // o mock não tem chave: a da linha é o id dela (chaveDaLinha)
  function divergenteDe(criada: ReturnType<typeof criarConciliacao>) {
    return criada.linhas.find((linha) => linha.status === "divergente_valor")!;
  }

  it("checks a linha in the first round, as you, and keeps it", () => {
    const criada = criarConciliacao();
    const divergente = divergenteDe(criada);

    const atualizada = registrarDecisaoNoMock(criada.id, divergente.id, "conferida", null);

    const esperada = { tipo: "conferida", texto: null, autor: "Você", em: "2026-09-30T13:12:00.000Z", rodada: 1 };
    const linha = atualizada?.linhas.find((item) => item.id === divergente.id);
    expect(linha?.decisao).toEqual(esperada);
    expect(linha?.eventos).toEqual([esperada]);
    expect(buscarConciliacao(criada.id)?.linhas.find((item) => item.id === divergente.id)?.decisao).toEqual(esperada);
  });

  it("undoing clears the decision with a new event, and keeps the old one", () => {
    const criada = criarConciliacao();
    const divergente = divergenteDe(criada);

    registrarDecisaoNoMock(criada.id, divergente.id, "justificada", "Juros de dois dias de atraso.");
    const desfeita = registrarDecisaoNoMock(criada.id, divergente.id, "justificativa_desfeita", null);

    const linha = desfeita?.linhas.find((item) => item.id === divergente.id);
    expect(linha?.decisao).toBeNull();
    expect(linha?.eventos?.map((evento) => [evento.tipo, evento.texto])).toEqual([
      ["justificada", "Juros de dois dias de atraso."],
      ["justificativa_desfeita", null],
    ]);
  });

  it("leaves the other linhas alone", () => {
    const criada = criarConciliacao();
    const outra = criada.linhas.find((linha) => linha.status === "sem_correspondencia")!;

    const atualizada = registrarDecisaoNoMock(criada.id, divergenteDe(criada).id, "conferida", null);

    expect(atualizada?.linhas.find((item) => item.id === outra.id)).toEqual(outra);
  });

  it("returns null for an unknown conciliação or linha", () => {
    expect(registrarDecisaoNoMock("nao-existe", "lc-2", "conferida", null)).toBeNull();
    const criada = criarConciliacao();
    expect(registrarDecisaoNoMock(criada.id, "lc-nao-existe", "conferida", null)).toBeNull();
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

  it("falls back to the defaults when localStorage is malformed", () => {
    window.localStorage.setItem("ledgr_regras_ativas", "not valid json {]");
    expect(listarRegras().ativas).toHaveLength(2);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  criarConciliacao,
  listarConciliacoes,
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
    window.localStorage.setItem("ledgr_conciliacoes", "not valid json {]");
    expect(listarConciliacoes()).toEqual([]);
  });
});

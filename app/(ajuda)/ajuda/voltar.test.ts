import { afterEach, describe, it, expect } from "vitest";
import { lembrarDeOndeVeio, paraOndeVoltar } from "./voltar";

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("a volta da Central de ajuda", () => {
  it("volta à tela de onde a ajuda foi aberta", () => {
    window.history.replaceState(null, "", "/extratos?filtro=banco");
    lembrarDeOndeVeio();
    expect(paraOndeVoltar()).toBe("/extratos?filtro=banco");
  });

  it("sem lembrança, vai para a Visão geral", () => {
    expect(paraOndeVoltar()).toBe("/visao-geral");
  });

  it("nunca sai do site nem volta para a própria ajuda", () => {
    for (const caminho of ["//outro.site/x", "https://outro.site", "/ajuda/extratos", "javascript:alert(1)"]) {
      sessionStorage.setItem("ledgr:voltar-da-ajuda", caminho);
      expect(paraOndeVoltar(), caminho).toBe("/visao-geral");
    }
  });
});

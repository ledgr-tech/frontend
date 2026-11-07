import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { LARGURA_DO_PAINEL, usePainelAtivo } from "./painel-ativo";

type Ouvinte = () => void;

/** Um matchMedia que se pode mexer: `largura` decide o `matches` e `mudar` avisa quem escuta. */
function telaDe(largura: number) {
  let atual = largura;
  const ouvintes = new Set<Ouvinte>();
  const consultas: string[] = [];
  window.matchMedia = ((consulta: string) => {
    consultas.push(consulta);
    return {
      get matches() {
        return atual >= LARGURA_DO_PAINEL;
      },
      media: consulta,
      addEventListener: (_: string, ouvinte: Ouvinte) => ouvintes.add(ouvinte),
      removeEventListener: (_: string, ouvinte: Ouvinte) => ouvintes.delete(ouvinte),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    consultas,
    ouvintes,
    mudar(nova: number) {
      atual = nova;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}

describe("usePainelAtivo", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pergunta pela largura de 1700px", () => {
    const tela = telaDe(1920);
    renderHook(() => usePainelAtivo());
    expect(tela.consultas.every((consulta) => consulta === "(min-width: 1700px)")).toBe(true);
  });

  it("é verdadeiro numa tela larga e falso numa estreita", () => {
    telaDe(1920);
    expect(renderHook(() => usePainelAtivo()).result.current).toBe(true);
    telaDe(1440);
    expect(renderHook(() => usePainelAtivo()).result.current).toBe(false);
  });

  it("acompanha a janela quando ela muda de largura, e para de escutar ao sair", () => {
    const tela = telaDe(1440);
    const { result, unmount } = renderHook(() => usePainelAtivo());
    expect(result.current).toBe(false);
    act(() => tela.mudar(1800));
    expect(result.current).toBe(true);
    act(() => tela.mudar(1280));
    expect(result.current).toBe(false);
    unmount();
    expect(tela.ouvintes.size).toBe(0);
  });
});

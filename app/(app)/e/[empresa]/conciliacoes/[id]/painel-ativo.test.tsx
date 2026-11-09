import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { LARGURA_DO_PAINEL, usePainelAtivo } from "./painel-ativo";

type Ouvinte = () => void;

/** Um matchMedia que se pode mexer: `largura` decide o `matches` e `mudar` avisa quem escuta. */
function telaDe(largura: number) {
  let atual = largura;
  const ouvintes = new Set<Ouvinte>();
  const consultas: string[] = [];
  vi.stubGlobal("matchMedia", (consulta: string) => {
    consultas.push(consulta);
    return {
      get matches() {
        return atual >= Number(consulta.match(/\d+/)?.[0]);
      },
      media: consulta,
      addEventListener: (_: string, ouvinte: Ouvinte) => ouvintes.add(ouvinte),
      removeEventListener: (_: string, ouvinte: Ouvinte) => ouvintes.delete(ouvinte),
    } as unknown as MediaQueryList;
  });
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
  afterEach(() => vi.unstubAllGlobals());

  it("pergunta pela largura de 1100px", () => {
    const tela = telaDe(1920);
    renderHook(() => usePainelAtivo());
    expect(LARGURA_DO_PAINEL).toBe(1100);
    expect(new Set(tela.consultas)).toEqual(new Set(["(min-width: 1100px)"]));
  });

  it.each([[1099, false], [1100, true], [1536, true], [1700, true]])("a %ipx, painel ativo: %s", (largura, ativo) => {
    telaDe(largura);
    expect(renderHook(() => usePainelAtivo()).result.current).toBe(ativo);
  });

  it("acompanha a janela quando ela muda de largura, e para de escutar ao sair", () => {
    const tela = telaDe(1099);
    const { result, unmount } = renderHook(() => usePainelAtivo());
    expect(result.current).toBe(false);
    act(() => tela.mudar(1100));
    expect(result.current).toBe(true);
    act(() => tela.mudar(1099));
    expect(result.current).toBe(false);
    unmount();
    expect(tela.ouvintes.size).toBe(0);
  });
});

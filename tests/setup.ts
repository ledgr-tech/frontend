import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// o next/font/google só existe compilado pelo Next (o index.js do pacote é vazio): nos testes,
// cada fonte vira só o nome da classe e da variável CSS
vi.mock("next/font/google", () => {
  const fonte = (nome: string) => () => ({
    className: `fonte-${nome}`,
    variable: `fonte-${nome}-variavel`,
    style: { fontFamily: nome },
  });
  return {
    Cormorant_Garamond: fonte("cormorant-garamond"),
    Inter: fonte("inter"),
    JetBrains_Mono: fonte("jetbrains-mono"),
    Newsreader: fonte("newsreader"),
  };
});

afterEach(() => {
  cleanup();
});

// jsdom não implementa IntersectionObserver; motion usa para whileInView.
// ponytail: dispara "visível" na hora — testes de landing só checam conteúdo, não animação.
if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      this.cb(
        [{ target: el, isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

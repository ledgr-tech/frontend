import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// o next/font/local só existe compilado pelo Next (fora dele, a função só lança erro): nos testes,
// cada fonte vira só o nome da classe e da variável CSS, tirado da própria variável
vi.mock("next/font/local", () => ({
  default: ({ variable = "--fonte" }: { variable?: string }) => {
    const nome = variable.replace(/^--/, "");
    return {
      className: `fonte-${nome}`,
      variable: `fonte-${nome}-variavel`,
      style: { fontFamily: nome },
    };
  },
}));

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

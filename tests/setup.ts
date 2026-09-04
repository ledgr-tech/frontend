import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

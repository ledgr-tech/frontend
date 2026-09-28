import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTeclaDeAtalho } from "./plataforma";

function fingirPlataforma(valor: string) {
  Object.defineProperty(window.navigator, "platform", { value: valor, configurable: true });
}

describe("useTeclaDeAtalho", () => {
  afterEach(() => {
    // apaga a propriedade própria: volta a valer a do protótipo, a do jsdom
    delete (window.navigator as unknown as Record<string, unknown>).platform;
  });

  it("is Ctrl on Windows", () => {
    fingirPlataforma("Win32");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("Ctrl");
  });

  it("is Ctrl on Linux", () => {
    fingirPlataforma("Linux x86_64");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("Ctrl");
  });

  it("is ⌘ on a Mac", () => {
    fingirPlataforma("MacIntel");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("⌘");
  });

  it("is ⌘ on an iPad", () => {
    fingirPlataforma("iPad");
    expect(renderHook(() => useTeclaDeAtalho()).result.current).toBe("⌘");
  });
});

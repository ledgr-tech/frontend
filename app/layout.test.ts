import { describe, it, expect } from "vitest";
import { metadata } from "./layout";

describe("site metadata", () => {
  // é o texto da prévia quando alguém manda o link: leva o argumento do pitch, como o hero
  it("describes the site by its pitch: keep your system, get only what does not match", () => {
    expect(metadata.description).toMatch(/do sistema de gestão que você já usa/);
    expect(metadata.description).toMatch(/aponta só o que não bate/);
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });
});

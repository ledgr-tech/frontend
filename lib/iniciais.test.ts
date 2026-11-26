import { describe, expect, it } from "vitest";
import { iniciais } from "./iniciais";

describe("iniciais", () => {
  it("takes the first letter of the first two words", () => {
    expect(iniciais("Aleksandra Wiśniewska-Kowalczyk")).toBe("AW");
    expect(iniciais("Christopher Alexander Montgomery III")).toBe("CA");
  });

  it("ignores extra spaces and keeps a one-word name to one letter", () => {
    expect(iniciais("  Sam   Lee ")).toBe("SL");
    expect(iniciais("Jo")).toBe("J");
    expect(iniciais("")).toBe("");
  });

  it("never splits a character in half", () => {
    expect(iniciais("🦊 Fox")).toBe("🦊F");
    expect(iniciais("dana")).toBe("D");
  });
});

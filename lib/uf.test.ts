import { describe, expect, it } from "vitest";
import { UFS, ehUf } from "./uf";

describe("UFS e ehUf (backend #184)", () => {
  it("são as 27 siglas, só em maiúscula", () => {
    expect(UFS).toHaveLength(27);
    expect(new Set(UFS).size).toBe(27);
    expect(ehUf("SP")).toBe(true);
    expect(ehUf("DF")).toBe(true);
    expect(ehUf("sp")).toBe(false);
    expect(ehUf("XX")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test environment", () => {
  it("renders a component into jsdom and can query it", () => {
    render(<p>ambiente de teste ok</p>);
    expect(screen.getByText("ambiente de teste ok")).toBeInTheDocument();
  });
});

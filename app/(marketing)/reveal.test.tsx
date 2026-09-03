import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InkHover, MotionRoot, PlanCard, Reveal } from "./reveal";

describe("Reveal", () => {
  it("sai de opacity 0 e revela quando entra na viewport", async () => {
    render(
      <MotionRoot>
        <Reveal>
          <span>conteúdo</span>
        </Reveal>
      </MotionRoot>,
    );

    const alvo = screen.getByText("conteúdo").parentElement as HTMLElement;
    expect(alvo).toHaveStyle({ opacity: "0" });
    await waitFor(() => expect(alvo).toHaveStyle({ opacity: "1" }), {
      timeout: 3000,
    });
  });

});

describe("InkHover", () => {
  afterEach(() => {
    // @ts-expect-error test-only cleanup of a jsdom global that doesn't exist by default
    delete window.matchMedia;
  });

  it("orients the ink stroke along the direction the pointer moved", () => {
    const { container } = render(
      <MotionRoot>
        <InkHover>
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;

    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });

    const drop = card.querySelector("[data-ink-drop]") as HTMLElement;
    expect(drop.style.transform).toContain("rotate(0deg)");
  });

  it("leaves an ink drop behind once the pointer has moved far enough", () => {
    const { container } = render(
      <MotionRoot>
        <InkHover>
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;

    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });

    expect(card.querySelectorAll("[data-ink-drop]")).toHaveLength(1);
  });

  it("does not leave another drop for a tiny pointer movement", () => {
    const { container } = render(
      <MotionRoot>
        <InkHover>
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;

    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 44, clientY: 0 });

    expect(card.querySelectorAll("[data-ink-drop]")).toHaveLength(1);
  });

  it("removes an ink drop once its animation ends", () => {
    const { container } = render(
      <MotionRoot>
        <InkHover>
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;
    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });
    const drop = card.querySelector("[data-ink-drop]") as HTMLElement;

    fireEvent.animationEnd(drop);

    expect(card.querySelectorAll("[data-ink-drop]")).toHaveLength(0);
  });

  it("does not carry a stroke over after the pointer leaves and re-enters", () => {
    const { container } = render(
      <MotionRoot>
        <InkHover>
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;
    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseLeave(card);

    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });

    expect(card.querySelectorAll("[data-ink-drop]")).toHaveLength(0);
  });

  it("skips ink drops when the user prefers reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { container } = render(
      <MotionRoot>
        <InkHover>
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;

    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });

    expect(card.querySelectorAll("[data-ink-drop]")).toHaveLength(0);
  });

  it("uses a lighter ink tone for dark backgrounds", () => {
    const { container } = render(
      <MotionRoot>
        <InkHover tone="light">
          <span>conteúdo</span>
        </InkHover>
      </MotionRoot>,
    );
    const card = container.querySelector("div") as HTMLElement;

    fireEvent.mouseMove(card, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(card, { clientX: 40, clientY: 0 });

    const drop = card.querySelector("[data-ink-drop]") as HTMLElement;
    expect(drop.className).toContain("ink-drop-light");
  });
});

describe("PlanCard", () => {
  it("moves a spotlight glow to the pointer position", async () => {
    const { container } = render(
      <MotionRoot>
        <PlanCard>
          <span>Plano</span>
        </PlanCard>
      </MotionRoot>,
    );
    const card = container.querySelector("[data-reveal] > div") as HTMLElement;

    fireEvent.mouseMove(card, { clientX: 30, clientY: 40 });

    await waitFor(() => expect(card.style.background).toContain("at 30px 40px"));
  });

  it("resets the spotlight off-screen when the pointer leaves", async () => {
    const { container } = render(
      <MotionRoot>
        <PlanCard>
          <span>Plano</span>
        </PlanCard>
      </MotionRoot>,
    );
    const card = container.querySelector("[data-reveal] > div") as HTMLElement;
    fireEvent.mouseMove(card, { clientX: 30, clientY: 40 });
    await waitFor(() => expect(card.style.background).toContain("at 30px 40px"));

    fireEvent.mouseLeave(card);

    await waitFor(() => expect(card.style.background).toContain("at -9999px -9999px"));
  });
});

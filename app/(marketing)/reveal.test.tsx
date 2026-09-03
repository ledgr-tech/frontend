import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarraConciliada, MotionRoot, Reveal } from "./reveal";

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

  it("BarraConciliada cresce até o percentual informado", async () => {
    const { container } = render(
      <MotionRoot>
        <BarraConciliada percentual={96.3} />
      </MotionRoot>,
    );

    const barra = container.querySelector("div") as HTMLElement;
    expect(barra.style.width).toBe("0px");
    await waitFor(() => expect(barra.style.width).toBe("96.3%"), {
      timeout: 3000,
    });
  });
});

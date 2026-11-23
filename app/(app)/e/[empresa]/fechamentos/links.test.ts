import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { criarLinkDoRelatorio } from "./links";

const chamarBackend = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: async () => "gestor@exemplo.test",
}));
vi.mock("../../../../(auth)/acoes", () => ({
  contaDaSessao: async () => ({ papel: "gestor" }),
}));

describe("criarLinkDoRelatorio", () => {
  beforeEach(() => {
    chamarBackend.mockReset();
  });

  it.each([
    { texto: "Não há fechamento ativo nesta competência.", motivo: "mes-reaberto" },
    { texto: "Link público não disponível.", motivo: "sem-rota" },
  ])("distingue o 404 de $motivo pelo texto do backend", async ({ texto, motivo }) => {
    chamarBackend.mockRejectedValue(new ErroBackend(404, texto));

    expect(await criarLinkDoRelatorio("2026-08", 30, "https://app.exemplo.test")).toEqual({
      ok: false, status: 404, erro: texto, motivo,
    });
    expect(chamarBackend).toHaveBeenCalledExactlyOnceWith("/fechamentos/2026-08/links", {
      method: "POST", corpo: { validade_dias: 30 },
    });
  });
});

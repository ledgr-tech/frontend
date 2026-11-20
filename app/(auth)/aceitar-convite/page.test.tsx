import { beforeEach, describe, expect, it, vi } from "vitest";
import AceitarConvitePage from "./page";

const conviteDoCookie = vi.fn(async () => ({ email: "ana@x.com", empresa: "Telha Certa", papel: "analista" }));
vi.mock("../acoes", () => ({ conviteDoCookie: () => conviteDoCookie() }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("./formulario", () => ({ AceitarConvite: () => null }));

async function abrir(google?: string) {
  const elemento = await AceitarConvitePage({ searchParams: Promise.resolve(google === undefined ? {} : { google }) });
  return elemento.props.google as { erro: string | null; convite: unknown };
}

describe("a página do convite", () => {
  beforeEach(() => conviteDoCookie.mockClear());

  it("sem ?google= não lê o cookie: o convite guardado pode ser de outra pessoa do navegador", async () => {
    expect((await abrir()).convite).toBeNull();
    expect(conviteDoCookie).not.toHaveBeenCalled();
  });

  it("na volta do Google lê o cookie, com o motivo ou com 'volta' ao recarregar", async () => {
    expect(await abrir("email_diferente")).toMatchObject({ erro: "email_diferente", convite: { email: "ana@x.com" } });
    expect(await abrir("volta")).toMatchObject({ erro: null, convite: { email: "ana@x.com" } });
  });

  it("um ?google= que não é motivo conhecido nem 'volta' não lê o cookie", async () => {
    expect((await abrir("qualquer-coisa")).convite).toBeNull();
    expect(conviteDoCookie).not.toHaveBeenCalled();
  });
});

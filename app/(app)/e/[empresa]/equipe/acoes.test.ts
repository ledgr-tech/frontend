import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConviteAPI, PessoaAPI } from "@/lib/adaptadores";
import { ErroBackend } from "@/lib/backend";
import { cancelarConvite, carregarEquipe, convidar, removerPessoa, transferirAdmin, trocarPapel } from "./acoes";

// a rede é a fronteira; ErroBackend e a tradução dos erros rodam de verdade
const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));

const pessoaApi: PessoaAPI = { id: "u1", nome: "Ana", email: "ana@x.com", administrador: true, criado_em: "2026-10-01T00:00:00Z" };
const pessoa = { id: "u1", nome: "Ana", email: "ana@x.com", papel: "admin" };
const conviteApi: ConviteAPI = { id: "c1", email: "bia@x.com", criado_em: "2026-10-16T12:00:00Z", expira_em: "2026-10-23T12:00:00Z" };
const CONVITE = "5c0f2a8e-1b3d-4e6f-9a7b-2c4d6e8f0a1b";
const PESSOA = "8e1d3c5b-7a9f-4b2d-8c6e-0f1a3b5c7d9e";
const convite = { id: "c1", email: "bia@x.com", papel: null, enviadoEm: "16/10/2026", valeAte: "23/10/2026" };

beforeEach(() => {
  chamarBackend.mockReset();
  emailDaSessao.mockResolvedValue("ana@x.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("na conta de demonstração", () => {
  // um visitante da demo mandaria convite do Ledgr para qualquer endereço, ou tiraria gente da empresa dos outros
  it.each([
    ["convidar", () => convidar("bia@x.com", "analista")],
    ["cancelarConvite", () => cancelarConvite(CONVITE)],
    ["removerPessoa", () => removerPessoa(PESSOA)],
  ])("%s recusa sem chamar o backend", async (_, acao) => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " Ana@X.com ");

    expect(await acao()).toEqual({ ok: false, status: 403, erro: "A conta de demonstração não pode ser alterada." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("outra conta segue normal", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.com.br");
    chamarBackend.mockResolvedValueOnce(undefined);

    expect(await removerPessoa(PESSOA)).toEqual({ ok: true, dados: null });
  });
});

describe("carregarEquipe", () => {
  it("o analista não lê os convites", async () => {
    chamarBackend.mockResolvedValueOnce({ itens: [pessoaApi] });

    expect(await carregarEquipe("analista")).toEqual({ ok: true, dados: { pessoas: [pessoa], convites: null } });
    expect(chamarBackend).toHaveBeenCalledTimes(1);
    expect(chamarBackend).toHaveBeenCalledWith("/empresa/usuarios");
  });

  it("o admin lê pessoas e convites", async () => {
    chamarBackend.mockImplementation(async (caminho: string) =>
      caminho === "/empresa/usuarios" ? { itens: [pessoaApi] } : { itens: [conviteApi] },
    );

    expect(await carregarEquipe("admin")).toEqual({ ok: true, dados: { pessoas: [pessoa], convites: [convite] } });
    expect(chamarBackend).toHaveBeenCalledWith("/empresa/convites");
  });

  it("o gestor também lê os convites, e o papel de cada pessoa vem do backend", async () => {
    chamarBackend.mockImplementation(async (caminho: string) =>
      caminho === "/empresa/usuarios"
        ? { itens: [{ ...pessoaApi, administrador: undefined, papel: "gestor" }] }
        : { itens: [{ ...conviteApi, papel: "analista" }] },
    );

    expect(await carregarEquipe("gestor")).toEqual({
      ok: true,
      dados: { pessoas: [{ ...pessoa, papel: "gestor" }], convites: [{ ...convite, papel: "analista" }] },
    });
  });

  it("um 403 na lista de convites não derruba a equipe", async () => {
    chamarBackend.mockImplementation(async (caminho: string) => {
      if (caminho === "/empresa/convites") throw new ErroBackend(403, "Forbidden");
      return { itens: [pessoaApi] };
    });

    expect(await carregarEquipe("gestor")).toEqual({ ok: true, dados: { pessoas: [pessoa], convites: null } });
  });

  it("404 ao carregar a equipe chega como status 404", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found"));

    expect(await carregarEquipe("analista")).toMatchObject({ ok: false, status: 404 });
  });
});

describe("convidar", () => {
  it("apara o e-mail antes de convidar", async () => {
    chamarBackend.mockResolvedValueOnce(conviteApi);

    expect(await convidar("  Bia@X.com ", "analista")).toEqual({ ok: true, dados: convite });
    expect(chamarBackend).toHaveBeenCalledWith("/empresa/convites", {
      method: "POST",
      corpo: { email: "Bia@X.com", papel: "analista" },
    });
  });

  it.each([
    [409, undefined, "Este e-mail já tem conta no Ledgr."],
    [429, 120, "Limite de convites por hora atingido. Tente de novo em 2 minutos."],
    [429, 61, "Limite de convites por hora atingido. Tente de novo em 2 minutos."],
    [429, 30, "Limite de convites por hora atingido. Tente de novo em 1 minuto."],
    [429, undefined, "Limite de convites por hora atingido. Tente de novo mais tarde."],
    [503, undefined, "O envio de convites está indisponível no momento."],
    [403, undefined, "Seu papel na conta não permite fazer isso."],
    [401, undefined, "Sua sessão expirou. Entre de novo para continuar."],
  ])("com %i (Retry-After %s) vira o texto certo", async (status, segundos, texto) => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(status, "x", [], {}, segundos));

    expect(await convidar("ana@x.com", "analista")).toEqual({ ok: false, status, erro: texto });
  });

  it("não manda ao backend um papel que não existe", async () => {
    expect(await convidar("bia@x.com", "dono" as never)).toEqual({ ok: false, status: 422, erro: "Escolha o papel da pessoa." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("devolve o papel dado no convite", async () => {
    chamarBackend.mockResolvedValueOnce({ ...conviteApi, papel: "gestor" });

    expect(await convidar("bia@x.com", "gestor")).toEqual({ ok: true, dados: { ...convite, papel: "gestor" } });
  });

  it("sem conseguir falar com o servidor, diz isso", async () => {
    chamarBackend.mockRejectedValueOnce(new TypeError("fetch failed"));

    expect(await convidar("ana@x.com", "analista")).toEqual({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
  });
});

describe("cancelarConvite e removerPessoa", () => {
  it("chamam DELETE com o id", async () => {
    chamarBackend.mockResolvedValue(undefined);

    expect(await cancelarConvite(CONVITE)).toEqual({ ok: true, dados: null });
    expect(await removerPessoa(PESSOA)).toEqual({ ok: true, dados: null });
    expect(chamarBackend).toHaveBeenCalledWith(`/empresa/convites/${CONVITE}`, { method: "DELETE" });
    expect(chamarBackend).toHaveBeenCalledWith(`/empresa/usuarios/${PESSOA}`, { method: "DELETE" });
  });

  it.each([
    ["cancelarConvite", () => cancelarConvite("..")],
    ["removerPessoa", () => removerPessoa("../convites")],
  ])("%s recusa id fora do formato sem chamar o backend", async (_, acao) => {
    // Server Action é endpoint público: o id vai no caminho da chamada ao backend
    expect(await acao()).toMatchObject({ ok: false, status: 404 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("o 409 do administrador volta com o texto do backend", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(409, "O administrador da empresa não pode ser removido."));

    expect(await removerPessoa(PESSOA)).toEqual({
      ok: false,
      status: 409,
      erro: "O administrador da empresa não pode ser removido.",
    });
  });
});

const BIA_API: PessoaAPI = { id: PESSOA, nome: "Bia", email: "bia@x.com", papel: "gestor", administrador: false, criado_em: "2026-10-02T00:00:00Z" };
const ANA_API: PessoaAPI = { id: "u1", nome: "Ana", email: "ana@x.com", papel: "gestor", administrador: false, criado_em: "2026-10-01T00:00:00Z" };

describe("trocarPapel", () => {
  it("manda o PATCH com o papel e devolve a pessoa adaptada", async () => {
    chamarBackend.mockResolvedValue(BIA_API);

    const resposta = await trocarPapel(PESSOA, "gestor");

    expect(chamarBackend).toHaveBeenCalledWith(`/empresa/usuarios/${PESSOA}`, { method: "PATCH", corpo: { papel: "gestor" } });
    expect(resposta).toEqual({ ok: true, dados: { id: PESSOA, nome: "Bia", email: "bia@x.com", papel: "gestor" } });
  });

  it("recusa antes do backend o que o backend recusaria: papel admin ou inventado, e id que não é UUID", async () => {
    expect(await trocarPapel(PESSOA, "admin")).toEqual({ ok: false, status: 422, erro: "Escolha o papel da pessoa." });
    expect(await trocarPapel(PESSOA, "chefe" as never)).toMatchObject({ ok: false, status: 422 });
    expect(await trocarPapel("../x", "gestor")).toEqual({ ok: false, status: 404, erro: "Pessoa não encontrada." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("na conta de demonstração recusa sem chamar o backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " Ana@X.com ");

    expect(await trocarPapel(PESSOA, "analista")).toEqual({ ok: false, status: 403, erro: "A conta de demonstração não pode ser alterada." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("transferirAdmin", () => {
  it("manda o POST com a senha e devolve a lista nova", async () => {
    chamarBackend.mockResolvedValue({ itens: [BIA_API, ANA_API] });

    const resposta = await transferirAdmin(PESSOA, "segredo");

    expect(chamarBackend).toHaveBeenCalledWith("/empresa/admin/transferencia", {
      method: "POST",
      corpo: { usuario_id: PESSOA, senha_atual: "segredo" },
    });
    expect(resposta).toEqual({
      ok: true,
      dados: [
        { id: PESSOA, nome: "Bia", email: "bia@x.com", papel: "gestor" },
        { id: "u1", nome: "Ana", email: "ana@x.com", papel: "gestor" },
      ],
    });
  });

  it("na conta só do Google (senha null) manda só o usuário", async () => {
    chamarBackend.mockResolvedValue({ itens: [] });

    await transferirAdmin(PESSOA, null);

    expect(chamarBackend).toHaveBeenCalledWith("/empresa/admin/transferencia", { method: "POST", corpo: { usuario_id: PESSOA } });
  });

  it("id que não é UUID e a conta de demonstração são recusados antes do backend", async () => {
    expect(await transferirAdmin("../x", "segredo")).toEqual({ ok: false, status: 404, erro: "Pessoa não encontrada." });
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " Ana@X.com ");
    expect(await transferirAdmin(PESSOA, "segredo")).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("transferirAdmin: o que chega da Server Action", () => {
  it("uma senha que não é texto nem null é recusada antes do backend", async () => {
    expect(await transferirAdmin(PESSOA, 123 as unknown as string)).toEqual({ ok: false, status: 400, erro: "Digite a sua senha atual." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe.each([
  ["trocarPapel", () => trocarPapel(PESSOA, "analista")],
  ["transferirAdmin", () => transferirAdmin(PESSOA, "segredo")],
])("os erros do backend em %s", (_, acao) => {
  it.each([
    [new ErroBackend(400, "Senha atual incorreta."), 400, "Senha atual incorreta."],
    [new ErroBackend(403, "Só o admin."), 403, "Seu papel na conta não permite fazer isso."],
    [new ErroBackend(404, "Usuário não encontrado."), 404, "Essa pessoa não está mais na conta."],
    [new ErroBackend(409, "O admin só muda de papel pela transferência."), 409, "O admin só muda de papel pela transferência."],
    [new ErroBackend(409, "Entre de novo com o Google para confirmar."), 409, "Entre de novo com o Google para confirmar."],
    [new ErroBackend(429, "Limite", [], {}, 180), 429, "Muitas tentativas. Tente de novo em 3 minutos."],
    [new ErroBackend(429, "Limite", [], {}, 60), 429, "Muitas tentativas. Tente de novo em 1 minuto."],
    [new ErroBackend(429, "Limite"), 429, "Muitas tentativas. Tente de novo mais tarde."],
    [new ErroBackend(401, "x"), 401, "Sua sessão expirou. Entre de novo para continuar."],
  ])("traduz o erro (%#)", async (erro, status, texto) => {
    chamarBackend.mockRejectedValue(erro);

    expect(await acao()).toEqual({ ok: false, status, erro: texto });
  });

  it("rede fora do ar vira status 0", async () => {
    chamarBackend.mockRejectedValue(new TypeError("fetch failed"));

    expect(await acao()).toEqual({ ok: false, status: 0, erro: "Não foi possível falar com o servidor." });
  });
});

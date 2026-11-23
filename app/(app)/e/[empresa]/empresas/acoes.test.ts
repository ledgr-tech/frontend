import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { PAPEL_INDISPONIVEL } from "@/lib/papel";
import { cadastrarEmpresa, carregarEmpresas, editarNomeDeExibicao, marcarFavorita } from "./acoes";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";

// a rede é a fronteira; ErroBackend e a tradução dos erros rodam de verdade
const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
const contaDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));
vi.mock("../../../../(auth)/acoes", () => ({ contaDaSessao: () => contaDaSessao() }));

const CNPJ = "11444777000161";
const CNPJ_ALFA = "AB12CD34EF5602";
const empresaApi = {
  id: "d71684ff-92bb-4adf-81a2-13598bc171d5",
  razao_social: "Cliente Dois Ltda",
  cnpj: CNPJ,
  cnpj_verificado_em: null,
  criado_em: "2026-10-21T19:48:16.773752Z",
};
const empresa = {
  id: empresaApi.id,
  razaoSocial: "Cliente Dois Ltda",
  nome: "Cliente Dois Ltda",
  cnpj: CNPJ,
  cnpjVerificado: false,
  criadaEm: "2026-10-21T19:48:16.773752Z",
};

beforeEach(() => {
  chamarBackend.mockReset();
  emailDaSessao.mockResolvedValue("ana@x.com");
  contaDaSessao.mockResolvedValue({ papel: "admin" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("carregarEmpresas", () => {
  it("devolve as empresas do escritório; o CNPJ só conta como verificado com a data da Receita", async () => {
    chamarBackend.mockResolvedValue({
      itens: [empresaApi, { ...empresaApi, id: "e6b87048-0f9e-4ee1-839d-2390220cdfb4", cnpj_verificado_em: "2026-10-22T10:00:00Z" }],
    });

    const resposta = await carregarEmpresas();

    // sem `total` é o backend anterior ao #157: uma chamada só, com tudo
    expect(chamarBackend).toHaveBeenCalledTimes(1);
    expect(chamarBackend).toHaveBeenCalledWith("/empresas?limit=100&offset=0");
    expect(resposta).toEqual({
      ok: true,
      dados: [empresa, { ...empresa, id: "e6b87048-0f9e-4ee1-839d-2390220cdfb4", cnpjVerificado: true }],
    });
  });

  it("com o backend #157, junta as páginas até o total e lê a favorita e a situação", async () => {
    const pagina = (n: number, desde: number) =>
      Array.from({ length: n }, (_, i) => ({ ...empresaApi, id: `id-${desde + i}`, favorita: desde + i === 0, status: "fechado" }));
    chamarBackend
      .mockResolvedValueOnce({ total: 150, limit: 100, offset: 0, itens: pagina(100, 0) })
      .mockResolvedValueOnce({ total: 150, limit: 100, offset: 100, itens: pagina(50, 100) });

    const resposta = await carregarEmpresas();

    expect(chamarBackend.mock.calls.map(([caminho]) => caminho)).toEqual(["/empresas?limit=100&offset=0", "/empresas?limit=100&offset=100"]);
    if (!resposta.ok) throw new Error("devia carregar");
    expect(resposta.dados).toHaveLength(150);
    expect(resposta.dados[0]).toMatchObject({ favorita: true, situacao: "fechado" });
    expect(resposta.dados[1]).toMatchObject({ favorita: false, situacao: "fechado" });
  });

  it("para numa página vazia mesmo que o total diga mais (uma empresa removida no meio)", async () => {
    chamarBackend
      .mockResolvedValueOnce({ total: 101, itens: Array.from({ length: 100 }, (_, i) => ({ ...empresaApi, id: `id-${i}` })) })
      .mockResolvedValueOnce({ total: 100, itens: [] });

    const resposta = await carregarEmpresas();

    expect(chamarBackend).toHaveBeenCalledTimes(2);
    expect(resposta.ok && resposta.dados).toHaveLength(100);
  });

  it("a rota ausente (backend anterior ao #143) chega como 404, para a tela dizer que ainda não existe", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(404, "Not Found"));

    expect(await carregarEmpresas()).toMatchObject({ ok: false, status: 404 });
  });
});

describe("cadastrarEmpresa", () => {
  it("CNPJ removido orienta a restaurar; CNPJ em apagamento conserva a explicação do backend", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(409, "Empresa removida.", [], {}, undefined, [], "empresa_removida"));
    expect(await cadastrarEmpresa(CNPJ, "Cliente")).toMatchObject({ ok: false, status: 409, erro: expect.stringContaining("Empresas removidas") });
    chamarBackend.mockRejectedValueOnce(new ErroBackend(409, "Esta empresa está sendo apagada. Tente novamente mais tarde.", [], {}, undefined, [], "empresa_sendo_apagada"));
    expect(await cadastrarEmpresa(CNPJ, "Cliente")).toMatchObject({ ok: false, status: 409, erro: "Esta empresa está sendo apagada. Tente novamente mais tarde." });
  });
  it("argumento que não é texto (ação chamada à mão) responde 422 em vez de lançar (S1-04)", async () => {
    expect(await cadastrarEmpresa("11.444.777/0001-61", ["x"] as unknown as string)).toMatchObject({ ok: false, status: 422 });
    expect(await cadastrarEmpresa({} as unknown as string, "Cliente")).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("manda o CNPJ só com letras e números e a razão social aparada, e devolve a empresa criada", async () => {
    chamarBackend.mockResolvedValue(empresaApi);

    const resposta = await cadastrarEmpresa("11.444.777/0001-61", "  Cliente Dois Ltda  ");

    expect(chamarBackend).toHaveBeenCalledWith("/empresas", {
      method: "POST",
      corpo: { cnpj: CNPJ, razao_social: "Cliente Dois Ltda" },
    });
    expect(resposta).toEqual({ ok: true, dados: empresa });
  });

  it("CNPJ alfanumérico digitado em minúsculas vai em maiúsculas, sem pontuação", async () => {
    chamarBackend.mockResolvedValue({ ...empresaApi, cnpj: CNPJ_ALFA });

    await cadastrarEmpresa("ab.12c.d34/ef56-02", "Cliente Alfa Ltda");

    expect(chamarBackend.mock.calls[0][1].corpo.cnpj).toBe(CNPJ_ALFA);
  });

  it("razão social vazia ou só espaços é recusada antes de chamar o backend", async () => {
    expect(await cadastrarEmpresa(CNPJ, "   ")).toEqual({ ok: false, status: 422, erro: "Informe a razão social." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("CNPJ com dígito errado é recusado antes de chamar o backend, com o texto do validador do cadastro", async () => {
    const resposta = await cadastrarEmpresa("11444777000162", "Cliente");

    expect(resposta).toEqual({ ok: false, status: 422, erro: "Os dígitos do CNPJ não conferem. Confira o número." });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("na conta de demonstração recusa sem chamar o backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", " Ana@X.com ");

    expect(await cadastrarEmpresa(CNPJ, "Cliente")).toEqual({
      ok: false,
      status: 403,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it.each([
    [new ErroBackend(409, "Empresa já cadastrada nesta conta."), 409, "Esta empresa já está cadastrada no escritório."],
    [new ErroBackend(402, "O plano permite até 3 empresas."), 402, "O plano permite até 3 empresas."],
    [new ErroBackend(429, "Limite", [], {}, 180), 429, "Muitos cadastros seguidos. Tente de novo em 3 minutos."],
    [new ErroBackend(429, "Limite", [], {}, 60), 429, "Muitos cadastros seguidos. Tente de novo em 1 minuto."],
    [new ErroBackend(429, "Limite"), 429, "Muitos cadastros seguidos. Tente de novo mais tarde."],
    [new ErroBackend(403, "Só o admin."), 403, "Seu papel no escritório não permite fazer isso."],
    [new ErroBackend(401, "x"), 401, "Sua sessão expirou. Entre de novo para continuar."],
    [
      new ErroBackend(422, "O servidor respondeu 422.", ["cnpj"], { cnpj: "CNPJ não encontrado na Receita." }),
      422,
      "CNPJ não encontrado na Receita.",
    ],
    [
      new ErroBackend(422, "O servidor respondeu 422.", ["cnpj"], { cnpj: "Value error, CNPJ inválido" }),
      422,
      "CNPJ inválido",
    ],
  ])("traduz o erro do backend (%#)", async (erro, status, texto) => {
    chamarBackend.mockRejectedValue(erro);

    expect(await cadastrarEmpresa(CNPJ, "Cliente")).toEqual({ ok: false, status, erro: texto });
  });

  it("rede fora do ar vira status 0", async () => {
    chamarBackend.mockRejectedValue(new TypeError("fetch failed"));

    expect(await cadastrarEmpresa(CNPJ, "Cliente")).toEqual({
      ok: false,
      status: 0,
      erro: SEM_SERVIDOR,
    });
  });
});

describe("marcarFavorita", () => {
  it("favorita com PUT e tira com DELETE", async () => {
    chamarBackend.mockResolvedValue(undefined);

    expect(await marcarFavorita(empresaApi.id, true)).toEqual({ ok: true, dados: null });
    expect(await marcarFavorita(empresaApi.id, false)).toEqual({ ok: true, dados: null });

    expect(chamarBackend).toHaveBeenNthCalledWith(1, `/empresas/${empresaApi.id}/favorita`, { method: "PUT" });
    expect(chamarBackend).toHaveBeenNthCalledWith(2, `/empresas/${empresaApi.id}/favorita`, { method: "DELETE" });
  });

  it("o 404 (empresa de outra conta) chega com o texto do backend", async () => {
    chamarBackend.mockRejectedValue(new ErroBackend(404, "Empresa não encontrada."));

    expect(await marcarFavorita(empresaApi.id, true)).toEqual({ ok: false, status: 404, erro: "Empresa não encontrada." });
  });

  it("um id que não é UUID (\"..\" viraria PUT /favorita) responde 404 sem chamar o backend (S1-03)", async () => {
    for (const id of ["..", "x/../../me", "", 42 as unknown as string]) {
      expect(await marcarFavorita(id, true)).toEqual({ ok: false, status: 404, erro: "Empresa não encontrada." });
    }
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("recusa a conta de demonstração sem chamar o backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.com.br");
    emailDaSessao.mockResolvedValue("demo@ledgr.com.br");

    expect(await marcarFavorita(empresaApi.id, true)).toMatchObject({ ok: false, status: 403 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });
});

describe("editarNomeDeExibicao", () => {
  it("id que não é UUID responde 422 sem chamar o backend", async () => {
    for (const id of ["..", "x/../../me", "", "nao-uuid", 42 as unknown as string]) {
      expect(await editarNomeDeExibicao(id, "Nome")).toEqual({ ok: false, status: 422, erro: "Empresa inválida." });
    }
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("nome que não é string nem null, ou passa de 120 caracteres depois de aparar, responde 422 sem chamar o backend", async () => {
    expect(await editarNomeDeExibicao(empresaApi.id, 123 as unknown as string)).toEqual({
      ok: false,
      status: 422,
      erro: "O nome pode ter até 120 caracteres.",
    });
    expect(await editarNomeDeExibicao(empresaApi.id, "a".repeat(121))).toEqual({
      ok: false,
      status: 422,
      erro: "O nome pode ter até 120 caracteres.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("recusa o analista antes de chamar o backend", async () => {
    contaDaSessao.mockResolvedValue({ papel: "analista" });

    expect(await editarNomeDeExibicao(empresaApi.id, "Loja Centro")).toEqual({
      ok: false,
      status: 403,
      erro: "Seu papel no escritório não permite fazer isso.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("sem confirmar o papel (/me indisponível) responde 503 sem chamar o backend", async () => {
    contaDaSessao.mockResolvedValue({ papel: "analista", indisponivel: true });

    expect(await editarNomeDeExibicao(empresaApi.id, "Loja Centro")).toEqual({
      ok: false,
      status: 503,
      erro: PAPEL_INDISPONIVEL,
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("recusa a conta de demonstração antes de chamar o backend", async () => {
    vi.stubEnv("LEDGR_CONTA_TESTE_EMAIL", "demo@ledgr.com.br");
    emailDaSessao.mockResolvedValue("demo@ledgr.com.br");

    expect(await editarNomeDeExibicao(empresaApi.id, "Loja Centro")).toEqual({
      ok: false,
      status: 403,
      erro: "A conta de demonstração não pode ser alterada.",
    });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it("manda o nome aparado no PATCH e devolve a empresa adaptada (admin e gestor)", async () => {
    contaDaSessao.mockResolvedValue({ papel: "gestor" });
    const nome = "a".repeat(120);
    chamarBackend.mockResolvedValue({ ...empresaApi, nome_exibicao: nome });

    const resposta = await editarNomeDeExibicao(empresaApi.id, `  ${nome}  `);

    expect(chamarBackend).toHaveBeenCalledWith(`/empresas/${empresaApi.id}`, {
      method: "PATCH",
      corpo: { nome_exibicao: nome },
    });
    expect(resposta).toEqual({
      ok: true,
      dados: { ...empresa, nome, nomeExibicao: nome },
    });
  });

  it.each(["", "   ", null])("vazio, só espaços ou null (%j) manda nome_exibicao null", async (valor) => {
    chamarBackend.mockResolvedValue({ ...empresaApi, nome_exibicao: null });

    const resposta = await editarNomeDeExibicao(empresaApi.id, valor);

    expect(chamarBackend).toHaveBeenCalledWith(`/empresas/${empresaApi.id}`, {
      method: "PATCH",
      corpo: { nome_exibicao: null },
    });
    expect(resposta).toEqual({
      ok: true,
      dados: { ...empresa, nome: "Cliente Dois Ltda", nomeExibicao: null },
    });
  });

  it.each([
    [new ErroBackend(404, "Empresa não encontrada."), 404, "Empresa não encontrada."],
    [new ErroBackend(403, "Só o admin ou o gestor."), 403, "Seu papel no escritório não permite fazer isso."],
    [new ErroBackend(403, "Conta inativa.", [], {}, undefined, [], "conta_inativa"), 403, "Conta inativa."],
    [new ErroBackend(422, "O nome pode ter até 120 caracteres."), 422, "O nome pode ter até 120 caracteres."],
    [new ErroBackend(429, "Limite", [], {}, 120), 429, "Muitas tentativas. Tente de novo em 2 minutos."],
    [new ErroBackend(429, "Limite", [], {}, 30), 429, "Muitas tentativas. Tente de novo em 1 minuto."],
    [new ErroBackend(429, "Limite"), 429, "Muitas tentativas. Tente de novo mais tarde."],
    [new ErroBackend(401, "x"), 401, "Sua sessão expirou. Entre de novo para continuar."],
  ])("traduz o erro do backend (%#)", async (erro, status, texto) => {
    chamarBackend.mockRejectedValue(erro);

    expect(await editarNomeDeExibicao(empresaApi.id, "Loja Centro")).toEqual({ ok: false, status, erro: texto });
  });

  it("rede fora do ar vira status 0", async () => {
    chamarBackend.mockRejectedValue(new TypeError("fetch failed"));

    expect(await editarNomeDeExibicao(empresaApi.id, "Loja Centro")).toEqual({
      ok: false,
      status: 0,
      erro: SEM_SERVIDOR,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroBackend } from "@/lib/backend";
import { carregarEmpresasRemovidas, removerEmpresa, restaurarEmpresa } from "./remocao-acoes";

const chamarBackend = vi.fn();
const emailDaSessao = vi.fn();
const contaDaSessao = vi.fn();
vi.mock("@/lib/backend", async (original) => ({
  ...(await original<typeof import("@/lib/backend")>()),
  chamarBackend: (...args: unknown[]) => chamarBackend(...args),
  emailDaSessao: () => emailDaSessao(),
}));
vi.mock("../../../../(auth)/acoes", () => ({ contaDaSessao: () => contaDaSessao() }));
vi.mock("@/lib/demo", () => ({ ehContaDeDemonstracao: (email: string) => email === "demo@teste.local", RECUSA_DEMONSTRACAO: "Indisponível na demonstração." }));

const ID = "d71684ff-92bb-4adf-81a2-13598bc171d5";
const REMOVIDA = {
  id: ID, razao_social: "Cliente de teste Ltda", nome_exibicao: "Filial",
  cnpj: "11444777000161", removida_em: "2026-11-23T01:00:00Z",
  removida_por_nome: "Ana", apagar_em: "2026-12-23T01:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  contaDaSessao.mockResolvedValue({ papel: "admin" });
  emailDaSessao.mockResolvedValue("admin@teste.local");
});

describe("remover e restaurar empresas", () => {
  it("DELETE devolve o nome e o prazo reais do backend, sem apagar os dados no front", async () => {
    chamarBackend.mockResolvedValue(REMOVIDA);
    expect(await removerEmpresa(ID)).toEqual({ ok: true, dados: {
      id: ID, nome: "Filial", razaoSocial: REMOVIDA.razao_social, cnpj: REMOVIDA.cnpj,
      removidaEm: REMOVIDA.removida_em, removidaPor: "Ana", apagarEm: REMOVIDA.apagar_em,
    } });
    expect(chamarBackend).toHaveBeenCalledWith(`/empresas/${ID}`, { method: "DELETE" });
  });

  it("lista o envelope itens, preserva a ordem do servidor e usa razão social sem nome de exibição", async () => {
    chamarBackend.mockResolvedValue({ itens: [REMOVIDA, { ...REMOVIDA, id: "outra", nome_exibicao: null }] });
    const resposta = await carregarEmpresasRemovidas();
    expect(chamarBackend).toHaveBeenCalledWith("/empresas/removidas");
    expect(resposta.ok && resposta.dados.map((e) => e.nome)).toEqual(["Filial", "Cliente de teste Ltda"]);
  });

  it("gestor restaura com POST sem corpo e adapta a empresa ativa", async () => {
    contaDaSessao.mockResolvedValue({ papel: "gestor" });
    chamarBackend.mockResolvedValue({ ...REMOVIDA, criado_em: "2026-10-01T10:00:00Z", cnpj_verificado_em: null });
    expect(await restaurarEmpresa(ID)).toMatchObject({ ok: true, dados: { id: ID, nome: "Filial", nomeExibicao: "Filial", cnpjVerificado: false } });
    expect(chamarBackend).toHaveBeenCalledWith(`/empresas/${ID}/restaurar`, { method: "POST" });
  });

  it.each(["analista", "indisponivel", "demo"])("recusa %s antes de consultar ou escrever no backend", async (caso) => {
    if (caso === "analista") contaDaSessao.mockResolvedValue({ papel: "analista" });
    if (caso === "indisponivel") contaDaSessao.mockResolvedValue({ papel: "analista", indisponivel: true });
    if (caso === "demo") emailDaSessao.mockResolvedValue("demo@teste.local");
    for (const acao of [() => carregarEmpresasRemovidas(), () => removerEmpresa(ID), () => restaurarEmpresa(ID)]) {
      expect(await acao()).toMatchObject({ ok: false, status: caso === "indisponivel" ? 503 : 403 });
    }
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it.each(["..", "../me", "x?y=z", null, 42, {}])("recusa id inválido %j nas duas escritas", async (id) => {
    expect(await removerEmpresa(id as string)).toMatchObject({ ok: false, status: 422 });
    expect(await restaurarEmpresa(id as string)).toMatchObject({ ok: false, status: 422 });
    expect(chamarBackend).not.toHaveBeenCalled();
  });

  it.each([
    [409, "A empresa principal não pode ser removida.", "empresa_principal"],
    [409, "Não remova a última empresa ativa.", "ultima_empresa"],
    [402, "O plano permite 5 empresas.", undefined],
    [404, "Empresa não encontrada.", undefined],
    [403, "Esta conta está inativa.", "conta_inativa"],
  ])("preserva a recusa %s: %s", async (status, texto, codigo) => {
    chamarBackend.mockRejectedValue(new ErroBackend(status, texto, [], {}, undefined, [], codigo));
    expect(await removerEmpresa(ID)).toEqual({ ok: false, status, erro: texto });
    expect(await restaurarEmpresa(ID)).toEqual({ ok: false, status, erro: texto });
  });

  it("traduz o limite por usuário pelo Retry-After e a ausência das rotas antigas", async () => {
    chamarBackend.mockRejectedValueOnce(new ErroBackend(429, "Rate limit", [], {}, 61));
    expect(await removerEmpresa(ID)).toMatchObject({ ok: false, status: 429, erro: "Muitas tentativas. Tente de novo em 2 minutos." });
    chamarBackend.mockRejectedValueOnce(new ErroBackend(404, "Not Found"));
    expect(await carregarEmpresasRemovidas()).toMatchObject({ ok: false, status: 404, erro: "Remover e restaurar empresas ainda não está disponível." });
  });
});

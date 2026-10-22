import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import type { EmpresaCliente } from "@/lib/adaptadores";
import type { LimitesDaConta } from "@/lib/limites";
import type { Papel } from "@/lib/papel";
import { ProvedorDaConta } from "../conta";
import { PainelDeEmpresas } from "./painel-de-empresas";

// a ação é a fronteira com o backend; aqui devolve o que ele responderia
const cadastrarEmpresa = vi.fn();
vi.mock("./acoes", () => ({ cadastrarEmpresa: (...args: unknown[]) => cadastrarEmpresa(...args) }));
vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: async () => true }));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/e/x/empresas" }));

const A: EmpresaCliente = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181", cnpjVerificado: true, criadaEm: "2026-10-08T17:59:02Z" };
const B: EmpresaCliente = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-21T19:48:16Z" };
const NOVA: EmpresaCliente = { id: "c0ffee00-0000-4000-8000-000000000001", razaoSocial: "Cliente Dois Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-22T10:00:00Z" };

function montar({ papel = "admin", limites = null }: { papel?: Papel; limites?: LimitesDaConta | null } = {}) {
  render(
    <ProvedorDaEmpresa ativa={{ id: A.id, razaoSocial: A.razaoSocial, cnpj: A.cnpj }} empresas={[A, B]}>
      <ProvedorDaConta preferencias={null} limites={limites} papel={papel}>
        <PainelDeEmpresas empresas={[A, B]} />
      </ProvedorDaConta>
    </ProvedorDaEmpresa>,
  );
}

const linhaDe = (nome: RegExp) => screen.getByRole("row", { name: nome });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.cookie = "ledgr-empresa-recente=; Path=/; Max-Age=0";
});

describe("a tabela das empresas", () => {
  it("mostra razão social, CNPJ formatado, Ativa, CNPJ verificado e a data de cadastro", () => {
    montar();

    expect(screen.getByRole("heading", { level: 1, name: "Empresas" })).toBeInTheDocument();
    expect(screen.getByText("2 empresas")).toBeInTheDocument();
    const padaria = linhaDe(/Padaria Ltda/);
    expect(within(padaria).getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(within(padaria).getByText("Ativa")).toBeInTheDocument();
    expect(within(padaria).getByText("CNPJ verificado")).toBeInTheDocument();
    expect(within(padaria).getByText("08/10/2026")).toBeInTheDocument();

    const mercado = linhaDe(/Mercado Ltda/);
    expect(within(mercado).queryByText("Ativa")).not.toBeInTheDocument();
    expect(within(mercado).queryByText("CNPJ verificado")).not.toBeInTheDocument();
    expect(within(mercado).getByText("21/10/2026")).toBeInTheDocument();
  });

  it("Abrir só aparece nas outras empresas e leva à Visão geral delas, lembrando a escolha", async () => {
    const user = userEvent.setup();
    montar();

    expect(within(linhaDe(/Padaria Ltda/)).queryByRole("button", { name: /Abrir/ })).not.toBeInTheDocument();
    await user.click(within(linhaDe(/Mercado Ltda/)).getByRole("button", { name: "Abrir Mercado Ltda" }));

    expect(document.cookie).toContain(`ledgr-empresa-recente=${B.id}`);
    expect(router.push).toHaveBeenCalledWith(`/e/${B.id}/visao-geral`);
  });
});

describe("a faixa do plano", () => {
  it("mostra quanto a conta usa e avisa quando falta pouco", () => {
    montar({ limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: null } });

    expect(screen.getByText("2 de 3 empresas")).toBeInTheDocument();
    expect(screen.getByText("Falta 1 empresa para o limite do plano.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver planos" })).not.toBeInTheDocument();
  });

  it("sem máximo mostra só a contagem, sem frase", () => {
    montar({ limites: { empresas: { usadas: 2, maximo: null }, usuarios: null } });

    expect(screen.getByText("2 empresas do plano")).toBeInTheDocument();
    expect(screen.queryByText(/limite/)).not.toBeInTheDocument();
  });

  it("no limite, diz isso e oferece ver os planos", () => {
    montar({ limites: { empresas: { usadas: 3, maximo: 3 }, usuarios: null } });

    expect(screen.getByText(/chegou ao limite de 3 empresas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", `/e/${A.id}/assinatura`);
  });

  it("sem os limites do /me, não há faixa", () => {
    montar({ limites: null });

    expect(screen.queryByText(/do plano/)).not.toBeInTheDocument();
  });
});

describe("quem cadastra", () => {
  it("o analista só vê a lista, com a explicação de quem cadastra", () => {
    montar({ papel: "analista" });

    expect(screen.getByText("Só o admin e o gestor cadastram empresas.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar empresa" })).not.toBeInTheDocument();
  });

  it.each<Papel>(["admin", "gestor"])("%s abre o formulário pelo botão do cabeçalho", async (papel) => {
    const user = userEvent.setup();
    montar({ papel });

    const botao = screen.getByRole("button", { name: "Adicionar empresa" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("form", { name: "Adicionar empresa" })).not.toBeInTheDocument();

    await user.click(botao);

    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("form", { name: "Adicionar empresa" })).toBeInTheDocument();
  });

  it("no limite o botão do cabeçalho fica desligado", () => {
    montar({ limites: { empresas: { usadas: 3, maximo: 3 }, usuarios: null } });

    expect(screen.getByRole("button", { name: "Adicionar empresa" })).toBeDisabled();
  });
});

/** O formulário de cadastro, aberto. */
async function formulario(opcoes: Parameters<typeof montar>[0] = {}) {
  const user = userEvent.setup();
  montar(opcoes);
  await user.click(screen.getByRole("button", { name: "Adicionar empresa" }));
  return { user, form: screen.getByRole("form", { name: "Adicionar empresa" }) as HTMLFormElement };
}

async function preencher(user: ReturnType<typeof userEvent.setup>, cnpj = "11444777000161", razao = "Cliente Dois Ltda") {
  await user.type(screen.getByLabelText("CNPJ"), cnpj);
  await user.type(screen.getByLabelText("Razão social"), razao);
}

describe("o cadastro de empresa", () => {
  it("o campo CNPJ aplica a máscara ao digitar", async () => {
    const { user } = await formulario();

    await user.type(screen.getByLabelText("CNPJ"), "11444777000161");

    expect(screen.getByLabelText("CNPJ")).toHaveValue("11.444.777/0001-61");
  });

  it("CNPJ inválido e razão social vazia são recusados na tela, sem chamar a ação", async () => {
    const { user } = await formulario();

    await user.type(screen.getByLabelText("CNPJ"), "11444777000162");
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));

    expect(screen.getByText("Os dígitos do CNPJ não conferem. Confira o número.")).toBeInTheDocument();
    expect(screen.getByText("Informe a razão social.")).toBeInTheDocument();
    expect(cadastrarEmpresa).not.toHaveBeenCalled();
  });

  it("cadastra, lembra a empresa nova e abre a Visão geral dela", async () => {
    cadastrarEmpresa.mockResolvedValue({ ok: true, dados: NOVA });
    const { user } = await formulario();

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/e/${NOVA.id}/visao-geral`));
    expect(cadastrarEmpresa).toHaveBeenCalledWith("11.444.777/0001-61", "Cliente Dois Ltda");
    expect(document.cookie).toContain(`ledgr-empresa-recente=${NOVA.id}`);
  });

  it("dois envios no mesmo instante chamam a ação uma vez só; o botão diz Cadastrando… e fica desligado", async () => {
    let concluir: (resposta: unknown) => void = () => {};
    cadastrarEmpresa.mockReturnValue(new Promise((resolve) => (concluir = resolve)));
    const { user, form } = await formulario();
    await preencher(user);

    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    expect(cadastrarEmpresa).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cadastrando…" })).toBeDisabled();
    await act(async () => concluir({ ok: true, dados: NOVA }));
  });

  it.each([
    [409, "Esta empresa já está cadastrada na conta."],
    [422, "CNPJ não encontrado na Receita."],
  ])("o %s aparece sob o campo CNPJ", async (status, erro) => {
    cadastrarEmpresa.mockResolvedValue({ ok: false, status, erro });
    const { user } = await formulario();

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));

    const mensagem = await screen.findByText(erro);
    expect(screen.getByLabelText("CNPJ")).toHaveAttribute("aria-describedby", mensagem.closest("[role=alert]")!.id);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("o 402 mostra a mensagem do backend com o link para os planos e relê o /me", async () => {
    cadastrarEmpresa.mockResolvedValue({ ok: false, status: 402, erro: "O plano permite até 3 empresas." });
    const { user, form } = await formulario();

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));

    await screen.findByText("O plano permite até 3 empresas.");
    expect(within(form).getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", `/e/${A.id}/assinatura`);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("o 429 mostra o aviso; o 403 mostra o aviso e relê a página", async () => {
    cadastrarEmpresa.mockResolvedValueOnce({ ok: false, status: 429, erro: "Muitos cadastros seguidos. Tente de novo em 3 minutos." });
    const { user } = await formulario();
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));
    await screen.findByText("Muitos cadastros seguidos. Tente de novo em 3 minutos.");
    expect(router.refresh).not.toHaveBeenCalled();

    cadastrarEmpresa.mockResolvedValueOnce({ ok: false, status: 403, erro: "Seu papel na conta não permite fazer isso." });
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));
    await screen.findByText("Seu papel na conta não permite fazer isso.");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("sessão vencida leva ao login", async () => {
    cadastrarEmpresa.mockResolvedValue({ ok: false, status: 401, erro: "x" });
    const { user } = await formulario();

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });

  it("no limite o formulário nem abre", async () => {
    const user = userEvent.setup();
    montar({ limites: { empresas: { usadas: 3, maximo: 3 }, usuarios: null } });

    await user.click(screen.getByRole("button", { name: "Adicionar empresa" }));

    expect(screen.queryByRole("form", { name: "Adicionar empresa" })).not.toBeInTheDocument();
    expect(cadastrarEmpresa).not.toHaveBeenCalled();
  });
});

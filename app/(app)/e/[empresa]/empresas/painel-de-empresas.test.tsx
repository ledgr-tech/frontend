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
// a equipe carrega junto com a tela; aqui o backend responde com três pessoas e um convite
const carregarEquipe = vi.fn();
vi.mock("../equipe/acoes", () => ({
  carregarEquipe: (...args: unknown[]) => carregarEquipe(...args),
  convidar: vi.fn(),
  cancelarConvite: vi.fn(),
  removerPessoa: vi.fn(),
}));
const EQUIPE = {
  pessoas: [
    { id: "u1", nome: "Ana", email: "ana@x.com", papel: "admin" },
    { id: "u2", nome: "Bia", email: "bia@x.com", papel: "analista" },
    { id: "u3", nome: "Gil", email: "gil@x.com", papel: "gestor" },
  ],
  convites: [{ id: "c1", email: "caio@x.com", papel: "analista", enviadoEm: "16/10/2026", valeAte: "23/10/2026" }],
};

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/e/x/empresas",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const A: EmpresaCliente = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181", cnpjVerificado: true, criadaEm: "2026-10-08T17:59:02Z" };
const B: EmpresaCliente = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-21T19:48:16Z" };
const NOVA: EmpresaCliente = { id: "c0ffee00-0000-4000-8000-000000000001", razaoSocial: "Cliente Dois Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-22T10:00:00Z" };

// a aba escolhida vem da URL (`?aba=equipe`): é o que o voltar do navegador devolve depois de uma troca
function montar({ papel = "admin", limites = null, aba }: { papel?: Papel; limites?: LimitesDaConta | null; aba?: "equipe" } = {}) {
  if (aba) window.history.replaceState(null, "", "/e/x/empresas?aba=equipe");
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
  window.history.replaceState(null, "", "/e/x/empresas");
  carregarEquipe.mockResolvedValue({ ok: true, dados: EQUIPE });
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

  it.each([
    ["no limite", 3, 3],
    ["acima do limite (um downgrade de plano)", 4, 3],
  ])("%s o botão do cabeçalho fica desligado", (_, usadas, maximo) => {
    montar({ limites: { empresas: { usadas, maximo }, usuarios: null } });

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

  it("o 402 continua na tela quando o refresh leva a conta ao limite: o formulário não some com a mensagem e o foco", async () => {
    cadastrarEmpresa.mockResolvedValue({ ok: false, status: 402, erro: "O plano permite até 3 empresas." });
    const user = userEvent.setup();
    const arvore = (limites: LimitesDaConta) => (
      <ProvedorDaEmpresa ativa={{ id: A.id, razaoSocial: A.razaoSocial, cnpj: A.cnpj }} empresas={[A, B]}>
        <ProvedorDaConta preferencias={null} limites={limites} papel="admin">
          <PainelDeEmpresas empresas={[A, B]} />
        </ProvedorDaConta>
      </ProvedorDaEmpresa>
    );
    const { rerender } = render(arvore({ empresas: { usadas: 2, maximo: 3 }, usuarios: null }));
    await user.click(screen.getByRole("button", { name: "Adicionar empresa" }));
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));
    await screen.findByText("O plano permite até 3 empresas.");

    // o router.refresh() relê o /me e a página volta com o contador no limite
    rerender(arvore({ empresas: { usadas: 3, maximo: 3 }, usuarios: null }));

    const form = screen.getByRole("form", { name: "Adicionar empresa" });
    expect(within(form).getByText("O plano permite até 3 empresas.")).toBeInTheDocument();
    expect(within(form).getByRole("link", { name: "Ver planos" })).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Cadastrar empresa" })).toBeDisabled();
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

describe("as abas Empresas e Equipe", () => {
  it("abre em Empresas, com o número de empresas e, depois de carregar, o de pessoas na aba Equipe", async () => {
    montar();

    const empresas = screen.getByRole("tab", { name: /^Empresas/ });
    expect(empresas).toHaveAttribute("aria-selected", "true");
    expect(empresas).toHaveTextContent("2");
    expect(await screen.findByRole("tab", { name: "Equipe 3" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Pessoas com acesso" })).not.toBeInTheDocument();
  });

  it("a aba da URL abre direto na Equipe, com o botão do cabeçalho de convidar", async () => {
    montar({ aba: "equipe" });

    expect(await screen.findByRole("list", { name: "Pessoas com acesso" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Equipe/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convidar pessoa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar empresa" })).not.toBeInTheDocument();
  });

  it("trocar de aba não recarrega a tela e grava ?aba=equipe na URL; voltar a Empresas tira o parâmetro", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("tab", { name: "Equipe 3" });

    await user.click(screen.getByRole("tab", { name: /^Equipe/ }));
    expect(await screen.findByRole("list", { name: "Pessoas com acesso" })).toBeInTheDocument();
    expect(window.location.search).toBe("?aba=equipe");
    expect(carregarEquipe).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("tab", { name: /^Empresas/ }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("cada aba tem o seu botão e o seu formulário aberto", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("tab", { name: "Equipe 3" });

    await user.click(screen.getByRole("button", { name: "Adicionar empresa" }));
    expect(screen.getByRole("form", { name: "Adicionar empresa" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^Equipe/ }));
    const convidar = screen.getByRole("button", { name: "Convidar pessoa" });
    expect(convidar).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("form", { name: "Adicionar empresa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Convidar pessoa" })).not.toBeInTheDocument();

    await user.click(convidar);
    expect(convidar).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("form", { name: "Convidar pessoa" })).toBeInTheDocument();
  });

  it("as setas andam entre as abas, que se selecionam ao receber o foco", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("tab", { name: "Equipe 3" });

    screen.getByRole("tab", { name: /^Empresas/ }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /^Equipe/ })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /^Equipe/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /^Empresas/ })).toHaveAttribute("aria-selected", "true");
  });

  it("o analista também vê a aba Equipe, mas sem o botão de convidar", async () => {
    montar({ papel: "analista", aba: "equipe" });

    expect(await screen.findByRole("list", { name: "Pessoas com acesso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convidar pessoa" })).not.toBeInTheDocument();
  });

  it("a faixa do plano das empresas tem a barra de uso quando há máximo, e não tem sem máximo", () => {
    const { unmount } = render(<span />);
    unmount();
    montar({ limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: null } });
    expect(document.querySelector(".faixa-plano-barra")).not.toBeNull();
  });

  it("sem máximo, a faixa não tem barra", () => {
    montar({ limites: { empresas: { usadas: 2, maximo: null }, usuarios: null } });
    expect(document.querySelector(".faixa-plano")).not.toBeNull();
    expect(document.querySelector(".faixa-plano-barra")).toBeNull();
  });
});

describe("os painéis das abas", () => {
  it("cada aba aponta para um painel que existe no DOM; o da aba inativa fica escondido", async () => {
    montar();
    await screen.findByRole("tab", { name: "Equipe 3" });

    for (const aba of screen.getAllByRole("tab")) {
      const painel = document.getElementById(aba.getAttribute("aria-controls")!);
      expect(painel, aba.textContent ?? "").not.toBeNull();
      expect(painel!.hidden).toBe(aba.getAttribute("aria-selected") !== "true");
    }
  });

  it("o que foi digitado numa aba sobrevive à troca de aba", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("tab", { name: "Equipe 3" });

    await user.click(screen.getByRole("tab", { name: /^Equipe/ }));
    await user.click(screen.getByRole("button", { name: "Convidar pessoa" }));
    await user.type(screen.getByLabelText("E-mail da pessoa"), "dani@x.com");
    await user.click(screen.getByRole("tab", { name: /^Empresas/ }));
    await user.click(screen.getByRole("tab", { name: /^Equipe/ }));

    expect(screen.getByLabelText("E-mail da pessoa")).toHaveValue("dani@x.com");
  });
});

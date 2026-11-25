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
const marcarFavorita = vi.fn();
const editarNomeDeExibicao = vi.fn();
const removerEmpresa = vi.fn();
const carregarEmpresasRemovidas = vi.fn();
const restaurarEmpresa = vi.fn();
vi.mock("./remocao-acoes", () => ({
  removerEmpresa: (...args: unknown[]) => removerEmpresa(...args),
  carregarEmpresasRemovidas: (...args: unknown[]) => carregarEmpresasRemovidas(...args),
  restaurarEmpresa: (...args: unknown[]) => restaurarEmpresa(...args),
}));
vi.mock("./acoes", () => ({
  cadastrarEmpresa: (...args: unknown[]) => cadastrarEmpresa(...args),
  marcarFavorita: (...args: unknown[]) => marcarFavorita(...args),
  editarNomeDeExibicao: (...args: unknown[]) => editarNomeDeExibicao(...args),
}));
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

const A: EmpresaCliente = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", nome: "Padaria Ltda", cnpj: "11222333000181", cnpjVerificado: true, criadaEm: "2026-10-08T17:59:02Z" };
const B: EmpresaCliente = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", nome: "Mercado Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-21T19:48:16Z" };
const NOVA: EmpresaCliente = { id: "c0ffee00-0000-4000-8000-000000000001", razaoSocial: "Cliente Dois Ltda", nome: "Cliente Dois Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-22T10:00:00Z" };

// a aba escolhida vem da URL (`?aba=equipe`): é o que o voltar do navegador devolve depois de uma troca
function montar({
  papel = "admin",
  limites = null,
  aba,
  empresas = [A, B],
  cobranca = true,
}: { papel?: Papel; limites?: LimitesDaConta | null; aba?: "equipe"; empresas?: EmpresaCliente[]; cobranca?: boolean } = {}) {
  if (aba) window.history.replaceState(null, "", "/e/x/empresas?aba=equipe");
  render(
    <ProvedorDaEmpresa ativa={{ id: A.id, razaoSocial: A.razaoSocial, nome: A.nome, cnpj: A.cnpj }} empresas={[A, B]}>
      <ProvedorDaConta cobrancaHabilitada={cobranca} preferencias={null} limites={limites} papel={papel}>
        <PainelDeEmpresas empresas={empresas} />
      </ProvedorDaConta>
    </ProvedorDaEmpresa>,
  );
}

const linhaDe = (nome: RegExp) => screen.getByRole("row", { name: nome });

const REMOVIDA = { id: B.id, nome: B.nome, razaoSocial: B.razaoSocial, cnpj: B.cnpj,
  removidaEm: "2026-11-23T01:00:00Z", removidaPor: "Ana", apagarEm: "2026-12-23T01:00:00Z" };

describe("remoção e restauração", () => {
  it.each(["admin", "gestor"] as const)("%s tem as ações de remover e ver removidas", (papel) => {
    montar({ papel });
    expect(screen.getByRole("button", { name: "Remover empresa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Empresas removidas" })).toBeInTheDocument();
  });

  it("analista não recebe controles nem consulta empresas removidas", () => {
    montar({ papel: "analista" });
    expect(screen.queryByRole("button", { name: "Remover empresa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empresas removidas" })).not.toBeInTheDocument();
    expect(carregarEmpresasRemovidas).not.toHaveBeenCalled();
  });

  it("confirma a empresa e as consequências; cancelar não envia e devolve o foco", async () => {
    const user = userEvent.setup();
    montar();
    const abrir = screen.getByRole("button", { name: "Remover empresa" });
    await user.click(abrir);
    const dialogo = screen.getByRole("dialog", { name: "Remover empresa" });
    expect(dialogo).toHaveTextContent("Mercado Ltda");
    expect(dialogo).toHaveTextContent("30 dias");
    expect(dialogo).toHaveTextContent("chaves de API");
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(removerEmpresa).not.toHaveBeenCalled();
    expect(abrir).toHaveFocus();
  });

  it("envia uma vez, impede fechar em voo e tira a empresa da lista só após confirmação do backend", async () => {
    let concluir!: (resposta: unknown) => void;
    removerEmpresa.mockReturnValue(new Promise((resolve) => { concluir = resolve; }));
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Remover empresa" }));
    const dialogo = screen.getByRole("dialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Confirmar remoção" });
    act(() => { confirmar.click(); confirmar.click(); });
    expect(removerEmpresa).toHaveBeenCalledExactlyOnceWith(B.id);
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialogo).toBeInTheDocument();
    expect(linhaDe(/Mercado/)).toBeInTheDocument();
    await act(async () => concluir({ ok: true, dados: REMOVIDA }));
    expect(screen.queryByRole("row", { name: /Mercado/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Mercado Ltda foi removida");
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: A.nome })).toHaveFocus();
  });

  it.each(["A empresa principal não pode ser removida.", "A última empresa não pode ser removida."])("exibe 409 e preserva a empresa: %s", async (erro) => {
    removerEmpresa.mockResolvedValue({ ok: false, status: 409, erro });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Remover empresa" }));
    await user.click(screen.getByRole("button", { name: "Confirmar remoção" }));
    expect(screen.getByRole("alert")).toHaveTextContent(erro);
    expect(linhaDe(/Mercado/)).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("lista o prazo e o autor da remoção e restaura sem perder o nome da empresa", async () => {
    carregarEmpresasRemovidas.mockResolvedValue({ ok: true, dados: [REMOVIDA] });
    restaurarEmpresa.mockResolvedValue({ ok: true, dados: B });
    const user = userEvent.setup();
    montar({ empresas: [A] });
    await user.click(screen.getByRole("button", { name: "Empresas removidas" }));
    const dialogo = screen.getByRole("dialog", { name: "Empresas removidas" });
    await within(dialogo).findByRole("button", { name: `Restaurar ${B.nome}` });
    expect(dialogo).toHaveTextContent("por Ana");
    expect(dialogo).toHaveTextContent("Restaurar até");
    await user.click(within(dialogo).getByRole("button", { name: `Restaurar ${B.nome}` }));
    expect(restaurarEmpresa).toHaveBeenCalledExactlyOnceWith(B.id);
    expect(within(dialogo).getByRole("status")).toHaveTextContent("Mercado Ltda foi restaurada");
    expect(within(dialogo).getByRole("button", { name: "Fechar" })).toHaveFocus();
    expect(within(dialogo).queryByRole("button", { name: `Restaurar ${B.nome}` })).not.toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(linhaDe(/Mercado Ltda/)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("limite do plano impede restaurar e conserva a empresa entre as removidas", async () => {
    carregarEmpresasRemovidas.mockResolvedValue({ ok: true, dados: [REMOVIDA] });
    restaurarEmpresa.mockResolvedValue({ ok: false, status: 402, erro: "O plano permite 5 empresas." });
    const user = userEvent.setup();
    montar({ empresas: [A] });
    await user.click(screen.getByRole("button", { name: "Empresas removidas" }));
    await user.click(await screen.findByRole("button", { name: `Restaurar ${B.nome}` }));
    expect(screen.getByRole("alert")).toHaveTextContent("O plano permite 5 empresas.");
    expect(screen.getByRole("button", { name: `Restaurar ${B.nome}` })).toBeEnabled();
    expect(screen.queryByRole("row", { name: /Mercado/ })).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("lista que falha tem nova tentativa; 401 na restauração vai ao login", async () => {
    carregarEmpresasRemovidas.mockResolvedValueOnce({ ok: false, status: 0, erro: "Sem conexão." })
      .mockResolvedValue({ ok: true, dados: [REMOVIDA] });
    restaurarEmpresa.mockResolvedValue({ ok: false, status: 401, erro: "Sessão expirada." });
    const user = userEvent.setup();
    montar({ empresas: [A] });
    await user.click(screen.getByRole("button", { name: "Empresas removidas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sem conexão.");
    await user.click(screen.getByRole("button", { name: "Atualizar lista" }));
    await user.click(await screen.findByRole("button", { name: `Restaurar ${B.nome}` }));
    expect(router.push).toHaveBeenCalledWith("/login");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  removerEmpresa.mockReset();
  restaurarEmpresa.mockReset();
  carregarEmpresasRemovidas.mockReset().mockResolvedValue({ ok: true, dados: [] });
  window.history.replaceState(null, "", "/e/x/empresas");
  carregarEquipe.mockResolvedValue({ ok: true, dados: EQUIPE });
});

afterEach(() => {
  document.cookie = "ledgr-empresa-recente=; Path=/; Max-Age=0";
});

describe("a lista das empresas e o painel", () => {
  const painel = () => screen.getByRole("complementary", { name: "Empresa escolhida" });

  it("lista razão social, CNPJ formatado e Ativa, em ordem alfabética, com a primeira já no painel", () => {
    montar();

    expect(screen.getByRole("heading", { level: 1, name: "Empresas" })).toBeInTheDocument();
    expect(screen.getByText("2 empresas")).toBeInTheDocument();
    const padaria = linhaDe(/Padaria Ltda/);
    expect(within(padaria).getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(within(padaria).getByText("Ativa")).toBeInTheDocument();
    expect(within(linhaDe(/Mercado Ltda/)).queryByText("Ativa")).not.toBeInTheDocument();

    // Mercado vem antes de Padaria e abre escolhida
    expect(linhaDe(/Mercado Ltda/)).toHaveAttribute("aria-selected", "true");
    expect(within(painel()).getByRole("heading", { level: 2, name: "Mercado Ltda" })).toBeInTheDocument();
    expect(within(painel()).getByText("Ainda não verificado")).toBeInTheDocument();
    expect(within(painel()).getByText("21/10/2026")).toBeInTheDocument();
  });

  it("escolher outra linha mostra os dados dela no painel", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(screen.getByRole("button", { name: "Padaria Ltda" }));
    expect(linhaDe(/Padaria Ltda/)).toHaveAttribute("aria-selected", "true");
    expect(within(painel()).getByText("Empresa cliente · aberta agora")).toBeInTheDocument();
    expect(within(painel()).getByText("CNPJ verificado")).toBeInTheDocument();
    expect(within(painel()).getByText("08/10/2026")).toBeInTheDocument();
  });

  it("leva o foco à prévia empilhada só quando a empresa é escolhida pelo teclado", async () => {
    const user = userEvent.setup();
    montar();

    const padaria = screen.getByRole("button", { name: "Padaria Ltda" });
    padaria.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(within(painel()).getByRole("heading", { name: "Padaria Ltda" })).toHaveFocus());

    const mercado = screen.getByRole("button", { name: "Mercado Ltda" });
    await user.click(mercado);
    expect(mercado).toHaveFocus();
  });

  it("Abrir esta empresa leva à Visão geral dela, lembrando a escolha; a ativa vai à própria Visão geral", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(within(painel()).getByRole("button", { name: "Abrir esta empresa" }));
    expect(document.cookie).toContain(`ledgr-empresa-recente=${B.id}`);
    expect(router.push).toHaveBeenCalledWith(`/e/${B.id}/visao-geral`);

    await user.click(screen.getByRole("button", { name: "Padaria Ltda" }));
    expect(within(painel()).queryByRole("button", { name: "Abrir esta empresa" })).not.toBeInTheDocument();
    await user.click(within(painel()).getByRole("button", { name: "Ir para a Visão geral" }));
    expect(router.push).toHaveBeenLastCalledWith(`/e/${A.id}/visao-geral`);
  });

  it("dois cliques numa linha abrem a empresa", async () => {
    const user = userEvent.setup();
    montar();

    await user.dblClick(linhaDe(/Mercado Ltda/));
    expect(router.push).toHaveBeenCalledWith(`/e/${B.id}/visao-geral`);
  });

  it("a busca acha pelo nome ou pelo CNPJ, com ou sem a máscara", async () => {
    const user = userEvent.setup();
    montar();
    const busca = screen.getByRole("searchbox", { name: "Buscar por razão social ou CNPJ" });

    await user.type(busca, "padaria");
    expect(screen.queryByRole("row", { name: /Mercado Ltda/ })).not.toBeInTheDocument();
    expect(within(painel()).getByRole("heading", { level: 2, name: "Padaria Ltda" })).toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, "11.444");
    expect(screen.queryByRole("row", { name: /Padaria Ltda/ })).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, "zzz");
    expect(screen.getByText("Nenhuma empresa com esse filtro ou essa busca.")).toBeInTheDocument();
  });

  it("sem a situação e a favorita do backend #157, não há filtro, estrela nem coluna Mês", () => {
    montar();
    expect(screen.queryByRole("group", { name: "Filtrar pela situação do mês" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /favorita/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Mês" })).not.toBeInTheDocument();
  });
});

describe("a situação do mês e as favoritas", () => {
  const COM_157 = [
    { ...A, favorita: false, situacao: "fechado" as const },
    { ...B, favorita: true, situacao: "em_aberto" as const },
    { ...NOVA, favorita: false, situacao: "sem_conciliacao" as const },
  ];
  const painel = () => screen.getByRole("complementary", { name: "Empresa escolhida" });

  it("mostra a situação em cada linha e as favoritas primeiro", () => {
    montar({ empresas: COM_157 });

    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      expect.stringContaining("Mercado Ltda"),
      expect.stringContaining("Cliente Dois Ltda"),
      expect.stringContaining("Padaria Ltda"),
    ]);
    expect(within(linhaDe(/Mercado Ltda/)).getByText("Mês em aberto")).toBeInTheDocument();
    expect(within(linhaDe(/Padaria Ltda/)).getByText("Mês fechado")).toBeInTheDocument();
  });

  it("o filtro pela situação do mês deixa só as daquela situação", async () => {
    const user = userEvent.setup();
    montar({ empresas: COM_157 });

    await user.click(screen.getByRole("button", { name: "Mês fechado (1)" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(within(painel()).getByRole("heading", { level: 2, name: "Padaria Ltda" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Todas (3)" }));
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("a estrela muda na hora e chama o backend", async () => {
    const user = userEvent.setup();
    marcarFavorita.mockResolvedValue({ ok: true, dados: null });
    montar({ empresas: COM_157 });

    await user.click(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" }));
    expect(marcarFavorita).toHaveBeenCalledWith(A.id, true);
    expect(screen.getByRole("button", { name: "Tirar Padaria Ltda das favoritas" })).toHaveAttribute("aria-pressed", "true");
    // a estrela não escolhe a linha por baixo dela
    expect(within(painel()).getByRole("heading", { level: 2, name: "Mercado Ltda" })).toBeInTheDocument();
  });

  it("uma recusa do backend desfaz a estrela e mostra o motivo", async () => {
    const user = userEvent.setup();
    marcarFavorita.mockResolvedValue({ ok: false, status: 403, erro: "A conta de demonstração não muda as favoritas." });
    montar({ empresas: COM_157 });

    await user.click(within(painel()).getByRole("button", { name: "Tirar das favoritas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A conta de demonstração não muda as favoritas.");
    expect(within(painel()).getByRole("button", { name: "Tirar das favoritas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("falha antiga não desfaz a estrela mais nova", async () => {
    let resolverPrimeira!: (valor: { ok: boolean; status: number; erro: string }) => void;
    const primeira = new Promise<{ ok: boolean; status: number; erro: string }>((resolve) => {
      resolverPrimeira = resolve;
    });
    marcarFavorita
      .mockReturnValueOnce(primeira)
      .mockResolvedValueOnce({ ok: true, dados: null })
      .mockResolvedValueOnce({ ok: true, dados: null });
    const user = userEvent.setup();
    montar({ empresas: COM_157 });

    await user.click(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" }));
    await user.click(screen.getByRole("button", { name: "Tirar Padaria Ltda das favoritas" }));
    await user.click(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" }));

    await act(async () => resolverPrimeira({ ok: false, status: 403, erro: "Falha antiga" }));
    expect(screen.getByRole("button", { name: "Tirar Padaria Ltda das favoritas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Falha antiga")).not.toBeInTheDocument();
  });

  it("depois de dois oks fora de ordem, a falha volta ao último ok", async () => {
    let primeira!: (resposta: { ok: true; dados: null }) => void;
    let segunda!: (resposta: { ok: true; dados: null }) => void;
    marcarFavorita
      .mockReturnValueOnce(new Promise((resolve) => { primeira = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { segunda = resolve; }))
      .mockResolvedValueOnce({ ok: false, status: 503, erro: "Não foi possível favoritar." });
    const user = userEvent.setup();
    montar({ empresas: COM_157 });

    await user.click(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" }));
    await user.click(screen.getByRole("button", { name: "Tirar Padaria Ltda das favoritas" }));
    await act(async () => segunda({ ok: true, dados: null }));
    await act(async () => primeira({ ok: true, dados: null }));
    await user.click(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" }));

    expect(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível favoritar.");
    expect(marcarFavorita.mock.calls).toEqual([[A.id, true], [A.id, false], [A.id, true]]);
  });

  it("dois cliques que falham voltam a estrela ao que o backend tinha", async () => {
    let resolverPrimeira!: (valor: { ok: boolean; status: number; erro: string }) => void;
    marcarFavorita
      .mockReturnValueOnce(new Promise((resolve) => (resolverPrimeira = resolve)))
      .mockResolvedValueOnce({ ok: false, status: 503, erro: "Falha nova" });
    const user = userEvent.setup();
    montar({ empresas: COM_157 });

    await user.click(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" }));
    await user.click(screen.getByRole("button", { name: "Tirar Padaria Ltda das favoritas" }));
    await act(async () => resolverPrimeira({ ok: false, status: 503, erro: "Falha antiga" }));

    expect(screen.getByRole("button", { name: "Marcar Padaria Ltda como favorita" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Falha nova");
  });
});

describe("a faixa do plano", () => {
  it("mostra quanto a conta usa e avisa quando falta pouco", () => {
    montar({ limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: null } });

    expect(screen.getByText("2 de 3 empresas")).toBeInTheDocument();
    expect(screen.getByText("Falta 1 empresa para o limite do plano.")).toBeInTheDocument();
    expect(screen.queryByText(/Assinatura/)).not.toBeInTheDocument();
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

  it("com a cobrança desligada, o limite aparece sem o caminho para os planos", () => {
    montar({ limites: { empresas: { usadas: 3, maximo: 3 }, usuarios: null }, cobranca: false });

    expect(screen.getByText(/chegou ao limite de 3 empresas/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver planos" })).not.toBeInTheDocument();
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
    expect(botao).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(botao);

    expect(within(screen.getByRole("dialog", { name: "Adicionar empresa" })).getByRole("form", { name: "Adicionar empresa" })).toBeInTheDocument();
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
    [409, "Esta empresa já está cadastrada no escritório."],
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
      <ProvedorDaEmpresa ativa={{ id: A.id, razaoSocial: A.razaoSocial, nome: A.nome, cnpj: A.cnpj }} empresas={[A, B]}>
        <ProvedorDaConta cobrancaHabilitada preferencias={null} limites={limites} papel="admin">
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

    cadastrarEmpresa.mockResolvedValueOnce({ ok: false, status: 403, erro: "Seu papel no escritório não permite fazer isso." });
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));
    await screen.findByText("Seu papel no escritório não permite fazer isso.");
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

describe("Empresas e Equipe na faixa dos filtros", () => {
  const pilula = (nome: RegExp) => screen.getByRole("button", { name: nome });

  it("abre em Empresas, com o número de empresas e, depois de carregar, o de pessoas na pílula Equipe", async () => {
    montar();

    const empresas = pilula(/^Empresas \(2\)/);
    expect(empresas).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("button", { name: "Equipe (3)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("columnheader", { name: "CNPJ" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Pessoas com acesso" })).not.toBeInTheDocument();
  });

  it("a URL abre direto na Equipe, com o botão do cabeçalho de convidar", async () => {
    montar({ aba: "equipe" });

    expect(await screen.findByRole("table", { name: "Pessoas com acesso" })).toBeInTheDocument();
    expect(pilula(/^Equipe/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("columnheader", { name: "CNPJ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Convidar pessoa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar empresa" })).not.toBeInTheDocument();
  });

  it("trocar não recarrega a tela e grava ?aba=equipe na URL; voltar a Empresas tira o parâmetro", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: "Equipe (3)" });

    await user.click(pilula(/^Equipe/));
    expect(await screen.findByRole("table", { name: "Pessoas com acesso" })).toBeInTheDocument();
    expect(window.location.search).toBe("?aba=equipe");
    expect(carregarEquipe).toHaveBeenCalledTimes(1);

    await user.click(pilula(/^Empresas/));
    expect(screen.getByRole("columnheader", { name: "CNPJ" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("cada visão tem o seu botão e o seu formulário aberto", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: "Equipe (3)" });

    await user.click(screen.getByRole("button", { name: "Adicionar empresa" }));
    const cadastro = screen.getByRole("dialog", { name: "Adicionar empresa" });
    await user.click(within(cadastro).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(pilula(/^Equipe/));
    const convidar = screen.getByRole("button", { name: "Convidar pessoa" });
    expect(convidar).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(convidar);
    expect(within(screen.getByRole("dialog", { name: "Convidar pessoa" })).getByRole("form", { name: "Convidar pessoa" })).toBeInTheDocument();
  });

  it("a busca e o filtro só aparecem em Empresas", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: "Equipe (3)" });

    expect(screen.getByRole("searchbox")).toBeInTheDocument();
    await user.click(pilula(/^Equipe/));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("o analista também vê a Equipe, mas sem o botão de convidar", async () => {
    montar({ papel: "analista", aba: "equipe" });

    expect(await screen.findByRole("table", { name: "Pessoas com acesso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convidar pessoa" })).not.toBeInTheDocument();
  });

  it("a faixa do plano das empresas tem a barra de uso quando há máximo", () => {
    montar({ limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: null } });
    expect(document.querySelector(".faixa-plano-barra")).not.toBeNull();
  });

  it("sem máximo, a faixa não tem barra", () => {
    montar({ limites: { empresas: { usadas: 2, maximo: null }, usuarios: null } });
    expect(document.querySelector(".faixa-plano")).not.toBeNull();
    expect(document.querySelector(".faixa-plano-barra")).toBeNull();
  });

  it("o que foi digitado numa visão sobrevive à troca", async () => {
    const user = userEvent.setup();
    montar();
    await screen.findByRole("button", { name: "Equipe (3)" });

    await user.click(pilula(/^Equipe/));
    await user.click(screen.getByRole("button", { name: "Convidar pessoa" }));
    await user.type(screen.getByLabelText("E-mail da pessoa"), "dani@x.com");
    await user.click(pilula(/^Empresas/));
    await user.click(pilula(/^Equipe/));

    expect(screen.getByLabelText("E-mail da pessoa")).toHaveValue("dani@x.com");
  });
});

describe("os modais de cadastrar e de convidar", () => {
  it("Adicionar empresa abre uma janela modal no meio da tela, com o texto e o formulário", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Adicionar empresa" }));

    const janela = screen.getByRole("dialog", { name: "Adicionar empresa" });
    expect(janela).toHaveClass("espia", "modal-suave");
    expect(within(janela).getByText("Cadastre uma empresa cliente pelo CNPJ. Ela entra no escritório e você passa a trabalhar nela.")).toBeInTheDocument();
    expect(within(janela).getByLabelText("CNPJ")).toBeInTheDocument();
  });

  it("a janela de cadastro fecha com Esc, com Cancelar e com um clique no fundo, mas não com um clique dentro", async () => {
    const user = userEvent.setup();
    montar();
    const abrirJanela = () => user.click(screen.getByRole("button", { name: "Adicionar empresa" }));

    await abrirJanela();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrirJanela();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrirJanela();
    await user.click(screen.getByLabelText("Razão social"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cadastrar com sucesso fecha a janela", async () => {
    cadastrarEmpresa.mockResolvedValue({ ok: true, dados: NOVA });
    const { user } = await formulario();

    await preencher(user);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("Convidar pessoa abre a janela do convite; Fechar, Esc e o clique no fundo a fecham; enviar não a fecha", async () => {
    const user = userEvent.setup();
    montar({ aba: "equipe" });
    await screen.findByRole("table", { name: "Pessoas com acesso" });
    const abrirJanela = () => user.click(screen.getByRole("button", { name: "Convidar pessoa" }));

    await abrirJanela();
    const janela = screen.getByRole("dialog", { name: "Convidar pessoa" });
    expect(janela).toHaveClass("espia", "modal-suave");
    await user.click(within(janela).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrirJanela();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await abrirJanela();
    await user.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("nome de exibição (#472)", () => {
  const painel = () => screen.getByRole("complementary", { name: "Empresa escolhida" });
  const COM_NOME: EmpresaCliente[] = [
    { ...A, nome: "Aconchego", nomeExibicao: "Aconchego", favorita: false, situacao: "fechado" },
    { ...B, nome: "Mercado Ltda", nomeExibicao: null, favorita: false, situacao: "em_aberto" },
  ];

  it("mostra o nome na tabela e no título do painel, ordena por ele, busca pelos dois e sempre mostra a razão social no painel", async () => {
    const user = userEvent.setup();
    montar({ empresas: COM_NOME });

    // Aconchego (razão social Padaria Ltda) vem antes de Mercado Ltda pelo nome mostrado
    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      expect.stringContaining("Aconchego"),
      expect.stringContaining("Mercado Ltda"),
    ]);
    expect(within(painel()).getByRole("heading", { level: 2, name: "Aconchego" })).toBeInTheDocument();
    expect(within(painel()).getByText("Razão social")).toBeInTheDocument();
    expect(within(painel()).getByText("Padaria Ltda")).toBeInTheDocument();

    // também quando o nome é igual à razão social, a linha Razão social aparece no painel
    await user.click(screen.getByRole("button", { name: "Mercado Ltda" }));
    expect(within(painel()).getByRole("heading", { level: 2, name: "Mercado Ltda" })).toBeInTheDocument();
    expect(within(painel()).getByText("Razão social").nextElementSibling).toHaveTextContent("Mercado Ltda");

    // busca acha pela razão social e pelo nome de exibição
    const busca = screen.getByRole("searchbox", { name: "Buscar por razão social ou CNPJ" });
    await user.type(busca, "Padaria");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Aconchego" })).toBeInTheDocument();
    await user.clear(busca);
    await user.type(busca, "aconch");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Aconchego" })).toBeInTheDocument();
  });

  it.each<Papel>(["admin", "gestor"])("%s vê Editar nome quando o backend manda nomeExibicao", (papel) => {
    montar({ papel, empresas: COM_NOME });

    expect(within(painel()).getByRole("button", { name: "Editar nome" })).toBeInTheDocument();
  });

  it("o analista não vê Editar nome", () => {
    montar({ papel: "analista", empresas: COM_NOME });

    expect(within(painel()).queryByRole("button", { name: "Editar nome" })).not.toBeInTheDocument();
  });

  it("sem a chave nomeExibicao (backend antigo), ninguém vê Editar nome", () => {
    montar({ papel: "admin", empresas: [A, B] });

    expect(within(painel()).queryByRole("button", { name: "Editar nome" })).not.toBeInTheDocument();
  });

  it("salvar manda o nome, atualiza na tabela e no painel (mantendo favorita e mês), fecha o formulário e chama router.refresh()", async () => {
    editarNomeDeExibicao.mockResolvedValue({
      ok: true,
      dados: { ...B, nome: "Mercadão", nomeExibicao: "Mercadão" },
    });
    const user = userEvent.setup();
    montar({ papel: "gestor", empresas: COM_NOME });

    await user.click(screen.getByRole("button", { name: "Mercado Ltda" }));
    await user.click(within(painel()).getByRole("button", { name: "Editar nome" }));

    const campo = within(painel()).getByLabelText("Nome de exibição");
    expect(campo).toHaveValue("Mercado Ltda");
    expect(campo).toHaveAttribute("maxLength", "120");
    // nomeExibicao é null: não oferece Voltar à razão social
    expect(within(painel()).queryByRole("button", { name: "Voltar à razão social" })).not.toBeInTheDocument();

    await user.clear(campo);
    await user.type(campo, "Mercadão");
    await user.click(within(painel()).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(within(painel()).queryByRole("form", { name: "Editar nome de exibição" })).not.toBeInTheDocument());
    expect(editarNomeDeExibicao).toHaveBeenCalledWith(B.id, "Mercadão");
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(within(painel()).getByRole("heading", { level: 2, name: "Mercadão" })).toBeInTheDocument();
    expect(within(linhaDe(/Mercadão/)).getByText("Mês em aberto")).toBeInTheDocument();
  });

  it("Voltar à razão social só aparece com nomeExibicao não nulo, manda null e atualiza a tela", async () => {
    editarNomeDeExibicao.mockResolvedValue({
      ok: true,
      dados: { ...A, nome: "Padaria Ltda", nomeExibicao: null },
    });
    const user = userEvent.setup();
    montar({ empresas: COM_NOME });

    await user.click(within(painel()).getByRole("button", { name: "Editar nome" }));
    expect(within(painel()).getByLabelText("Nome de exibição")).toHaveValue("Aconchego");
    await user.click(within(painel()).getByRole("button", { name: "Voltar à razão social" }));

    await waitFor(() => expect(within(painel()).queryByRole("form", { name: "Editar nome de exibição" })).not.toBeInTheDocument());
    expect(editarNomeDeExibicao).toHaveBeenCalledWith(A.id, null);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(within(painel()).getByRole("heading", { level: 2, name: "Padaria Ltda" })).toBeInTheDocument();
  });

  it("dois envios no mesmo instante chamam a ação uma vez só, e um erro aparece na linha do formulário", async () => {
    let concluir!: (resposta: unknown) => void;
    editarNomeDeExibicao.mockReturnValueOnce(new Promise((resolve) => (concluir = resolve)));
    const user = userEvent.setup();
    montar({ empresas: COM_NOME });

    await user.click(within(painel()).getByRole("button", { name: "Editar nome" }));
    const form = within(painel()).getByRole("form", { name: "Editar nome de exibição" }) as HTMLFormElement;

    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });

    expect(editarNomeDeExibicao).toHaveBeenCalledTimes(1);
    expect(within(form).getByRole("button", { name: "Salvando…" })).toBeDisabled();

    await act(async () => concluir({ ok: false, status: 422, erro: "O nome pode ter até 120 caracteres." }));
    expect(within(form).getByRole("alert")).toHaveTextContent("O nome pode ter até 120 caracteres.");
    expect(router.refresh).not.toHaveBeenCalled();

    await user.click(within(form).getByRole("button", { name: "Cancelar" }));
    expect(within(painel()).queryByRole("form", { name: "Editar nome de exibição" })).not.toBeInTheDocument();
    // o foco volta ao botão que abriu o formulário, não cai no body
    expect(within(painel()).getByRole("button", { name: "Editar nome" })).toHaveFocus();
  });

  it("sessão vencida (401) ao editar manda para o login; trocar de empresa fecha o formulário", async () => {
    editarNomeDeExibicao.mockResolvedValue({ ok: false, status: 401, erro: "Sua sessão expirou." });
    const user = userEvent.setup();
    montar({ empresas: COM_NOME });

    await user.click(within(painel()).getByRole("button", { name: "Editar nome" }));
    await user.click(screen.getByRole("button", { name: "Mercado Ltda" }));
    expect(within(painel()).queryByRole("form", { name: "Editar nome de exibição" })).not.toBeInTheDocument();

    await user.click(within(painel()).getByRole("button", { name: "Editar nome" }));
    await user.click(within(painel()).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });
});

describe("a contagem do plano concorda com o máximo (#512)", () => {
  it.each<[number, number | null, string, string]>([
    [1, 5, "1 de 5 empresas do plano", "1 de 5 empresas"],
    [1, 1, "1 de 1 empresa do plano", "1 de 1 empresa"],
    [2, 1, "2 de 1 empresa do plano", "2 de 1 empresa"],
    [2, 5, "2 de 5 empresas do plano", "2 de 5 empresas"],
    [1, null, "1 empresa", "1 empresa do plano"],
    [2, null, "2 empresas", "2 empresas do plano"],
  ])("%s usadas, máximo %s", (usadas, maximo, resumo, faixa) => {
    montar({ empresas: [A, B].slice(0, usadas), limites: { empresas: { usadas, maximo }, usuarios: null } });

    expect(document.querySelector(".tela-contexto")?.textContent).toBe(resumo);
    expect(document.querySelector(".faixa-plano strong")?.textContent).toBe(faixa);
  });

  it("com 1 de 5, o singular não aparece", () => {
    montar({ empresas: [A], limites: { empresas: { usadas: 1, maximo: 5 }, usuarios: null } });

    expect(screen.queryByText("1 de 5 empresa")).not.toBeInTheDocument();
    expect(screen.queryByText("1 de 5 empresa do plano")).not.toBeInTheDocument();
  });
});

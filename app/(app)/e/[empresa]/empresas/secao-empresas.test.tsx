import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import type { EmpresaCliente } from "@/lib/adaptadores";
import type { LimitesDaConta } from "@/lib/limites";
import type { Papel } from "@/lib/papel";
import { ProvedorDaConta } from "../conta";
import { useLinhasDasEmpresas } from "./secao-empresas";

// as ações são a fronteira com o backend; aqui devolvem o que ele responderia
const carregarEmpresas = vi.fn();
const cadastrarEmpresa = vi.fn();
vi.mock("./acoes", () => ({
  carregarEmpresas: (...args: unknown[]) => carregarEmpresas(...args),
  cadastrarEmpresa: (...args: unknown[]) => cadastrarEmpresa(...args),
}));
vi.mock("../../../../(auth)/acoes", () => ({ salvarPreferencias: async () => true }));

const caminho = vi.hoisted(() => ({ atual: "/e/x/fechamentos" }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => caminho.atual }));

const A: EmpresaCliente = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181", cnpjVerificado: true, criadaEm: "2026-10-08T17:59:02Z" };
const B: EmpresaCliente = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", cnpj: "11444777000161", cnpjVerificado: false, criadaEm: "2026-10-21T19:48:16Z" };

/** As linhas do hook como a janela de Configurações as mostra: título, descrição e controle. */
function Linhas({ papel, aoAbrir }: { papel: Papel; aoAbrir: () => void }) {
  const linhas = useLinhasDasEmpresas({ aberta: true, papel, aoAbrir });
  return (
    <ul>
      {linhas.map((linha) => (
        <li key={linha.chave ?? linha.titulo}>
          <span className="titulo">{linha.titulo}</span>
          {linha.descricao && <span>{linha.descricao}</span>}
          {linha.controle}
        </li>
      ))}
    </ul>
  );
}

function montar({ papel = "admin", limites = null, aoAbrir = vi.fn() }: { papel?: Papel; limites?: LimitesDaConta | null; aoAbrir?: () => void } = {}) {
  render(
    <ProvedorDaEmpresa ativa={{ id: A.id, razaoSocial: A.razaoSocial, cnpj: A.cnpj }} empresas={[A, B]}>
      <ProvedorDaConta preferencias={null} limites={limites} papel={papel}>
        <Linhas papel={papel} aoAbrir={aoAbrir} />
      </ProvedorDaConta>
    </ProvedorDaEmpresa>,
  );
  return { aoAbrir };
}

/** A linha inteira de uma empresa (ou de um título fixo). */
function linhaDe(titulo: string) {
  return screen.getByText(titulo, { selector: ".titulo" }).closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  caminho.atual = `/e/${A.id}/fechamentos`;
  carregarEmpresas.mockResolvedValue({ ok: true, dados: [A, B] });
});

afterEach(() => {
  document.cookie = "ledgr-empresa-recente=; Path=/; Max-Age=0";
});

describe("a lista das empresas", () => {
  it("carrega ao abrir e mostra razão social, CNPJ formatado, Ativa e CNPJ verificado onde couber", async () => {
    montar();
    expect(screen.getByText("Carregando as empresas…")).toBeInTheDocument();

    await screen.findByText("Padaria Ltda", { selector: ".titulo" });
    const padaria = linhaDe("Padaria Ltda");
    expect(within(padaria).getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(within(padaria).getByText("Ativa")).toBeInTheDocument();
    expect(within(padaria).getByText("CNPJ verificado")).toBeInTheDocument();

    const mercado = linhaDe("Mercado Ltda");
    expect(within(mercado).getByText("11.444.777/0001-61")).toBeInTheDocument();
    expect(within(mercado).queryByText("Ativa")).not.toBeInTheDocument();
    expect(within(mercado).queryByText("CNPJ verificado")).not.toBeInTheDocument();
    expect(carregarEmpresas).toHaveBeenCalledTimes(1);
  });

  it("Abrir só aparece nas empresas que não são a ativa e leva à mesma tela da outra, lembrando a escolha", async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar();
    await screen.findByText("Mercado Ltda", { selector: ".titulo" });

    expect(within(linhaDe("Padaria Ltda")).queryByRole("button", { name: /Abrir/ })).not.toBeInTheDocument();
    await user.click(within(linhaDe("Mercado Ltda")).getByRole("button", { name: "Abrir Mercado Ltda" }));

    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(document.cookie).toContain(`ledgr-empresa-recente=${B.id}`);
    expect(router.push).toHaveBeenCalledWith(`/e/${B.id}/fechamentos`);
  });

  it("sem a rota (404, backend anterior ao #143) diz que ainda não existe e não oferece cadastro", async () => {
    carregarEmpresas.mockResolvedValue({ ok: false, status: 404, erro: "Not Found" });
    montar();

    await screen.findByText("As empresas ainda não estão disponíveis.");
    expect(screen.queryByText("Adicionar empresa", { selector: ".titulo" })).not.toBeInTheDocument();
  });

  it("quando falha, oferece tentar de novo e recarrega", async () => {
    const user = userEvent.setup();
    carregarEmpresas.mockResolvedValueOnce({ ok: false, status: 500, erro: "x" });
    montar();

    await screen.findByText("Não foi possível carregar agora.");
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    expect(carregarEmpresas).toHaveBeenCalledTimes(2);
  });

  it("sessão vencida leva ao login", async () => {
    carregarEmpresas.mockResolvedValue({ ok: false, status: 401, erro: "x" });
    montar();

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/login"));
  });
});

describe("o limite de empresas do plano", () => {
  it("mostra quanto a conta usa e avisa quando falta pouco", async () => {
    montar({ limites: { empresas: { usadas: 2, maximo: 3 }, usuarios: null } });

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    const plano = linhaDe("Empresas do plano");
    expect(within(plano).getByText("2 de 3 empresas")).toBeInTheDocument();
    expect(within(plano).getByText("Falta 1 empresa para o limite do plano.")).toBeInTheDocument();
  });

  it("sem máximo mostra só a contagem, sem frase", async () => {
    montar({ limites: { empresas: { usadas: 2, maximo: null }, usuarios: null } });

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    const plano = linhaDe("Empresas do plano");
    expect(within(plano).getByText("2 empresas")).toBeInTheDocument();
    expect(within(plano).queryByText(/limite/)).not.toBeInTheDocument();
  });

  it("no limite, oferece ver os planos", async () => {
    montar({ limites: { empresas: { usadas: 3, maximo: 3 }, usuarios: null } });

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    const plano = linhaDe("Empresas do plano");
    expect(within(plano).getByText(/chegou ao limite de 3 empresas/)).toBeInTheDocument();
    expect(within(plano).getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", `/e/${A.id}/assinatura`);
  });

  it("sem limites do /me, nenhuma linha do plano", async () => {
    montar({ limites: null });

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    expect(screen.queryByText("Empresas do plano", { selector: ".titulo" })).not.toBeInTheDocument();
  });
});

describe("quem cadastra", () => {
  it("o analista só vê a lista, com a explicação de quem cadastra", async () => {
    montar({ papel: "analista" });

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    const adicionar = linhaDe("Adicionar empresa");
    expect(within(adicionar).getByText("Só o admin e o gestor cadastram empresas.")).toBeInTheDocument();
    expect(within(adicionar).queryByRole("button")).not.toBeInTheDocument();
  });

  it.each<Papel>(["admin", "gestor"])("%s vê o botão de adicionar", async (papel) => {
    montar({ papel });

    await screen.findByText("Mercado Ltda", { selector: ".titulo" });
    expect(within(linhaDe("Adicionar empresa")).getByRole("button", { name: "Adicionar empresa" })).toBeInTheDocument();
  });
});

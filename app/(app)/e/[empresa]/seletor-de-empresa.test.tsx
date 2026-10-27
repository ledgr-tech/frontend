import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaEmpresa, type EmpresaDaConta } from "@/lib/empresa-ativa";
import { SeletorDeEmpresa } from "./seletor-de-empresa";

const caminho = vi.hoisted(() => ({ atual: "/e/x/fechamentos" }));
const roteador = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => caminho.atual,
  useRouter: () => roteador,
}));

const A: EmpresaDaConta = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181" };
const B: EmpresaDaConta = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", cnpj: "11444777000161" };

function montar(empresas: EmpresaDaConta[] = [A, B], ativa: EmpresaDaConta = empresas[0]) {
  return render(
    <ProvedorDaEmpresa ativa={ativa} empresas={empresas}>
      <SeletorDeEmpresa />
    </ProvedorDaEmpresa>,
  );
}

/** N empresas, "Empresa 01" a "Empresa N", cada uma com um CNPJ diferente. */
function muitas(n: number): EmpresaDaConta[] {
  return Array.from({ length: n }, (_, i) => {
    const numero = String(i + 1).padStart(2, "0");
    return { id: `00000000-0000-4000-8000-0000000000${numero}`, razaoSocial: `Empresa ${numero}`, cnpj: `${numero}222333000181` };
  });
}

function janela() {
  return within(screen.getByRole("dialog", { name: "Trocar de empresa" }));
}

function nomesNaTabela() {
  return janela()
    .getAllByRole("row")
    .slice(1)
    .map((linha) => within(within(linha).getAllByRole("cell")[0]).getByRole("button").textContent);
}

beforeEach(() => {
  caminho.atual = `/e/${A.id}/fechamentos`;
  vi.clearAllMocks();
});

afterEach(() => {
  document.cookie = "ledgr-empresa-recente=; Path=/; Max-Age=0";
});

describe("SeletorDeEmpresa (no topo, #223)", () => {
  it("mostra a empresa ativa mesmo com uma só, num botão que abre uma janela", () => {
    montar([A]);
    const botao = screen.getByRole("button", { name: "Empresa: Padaria Ltda" });
    expect(botao).toHaveAttribute("aria-haspopup", "dialog");
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  it("abre a tabela das empresas da conta, com o CNPJ formatado e a aberta marcada", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    expect(nomesNaTabela()).toEqual(["Mercado Ltda", "Padaria Ltda"]);
    const padaria = janela().getByRole("button", { name: "Padaria Ltda" }).closest("tr")!;
    expect(padaria).toHaveAttribute("aria-current", "true");
    expect(within(padaria).getByText("Aberta agora")).toBeInTheDocument();
    expect(within(padaria).getAllByRole("cell")[1]).toHaveTextContent("11.222.333/0001-81");
  });

  it("trocar leva à mesma tela da outra empresa, lembra a escolha e fecha a janela", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.click(janela().getByRole("button", { name: "Mercado Ltda" }));
    expect(roteador.push).toHaveBeenCalledWith(`/e/${B.id}/fechamentos`);
    expect(document.cookie).toContain(`ledgr-empresa-recente=${B.id}`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("de uma tela com id (a comparação), vai à raiz da seção, porque o id não existe no outro cliente", async () => {
    caminho.atual = `/e/${A.id}/conciliacoes/7a2b9c4d-1e3f-4a5b-8c6d-9e0f1a2b3c4d`;
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.click(janela().getByRole("button", { name: "Mercado Ltda" }));
    // a comparação é da seção Conciliações, cuja raiz é o /dashboard
    expect(roteador.push).toHaveBeenCalledWith(`/e/${B.id}/dashboard`);
  });

  it("escolher a própria empresa aberta só fecha a janela", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.click(janela().getByRole("button", { name: "Padaria Ltda" }));
    expect(roteador.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Escape fecha a janela", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("busca por razão social e por CNPJ, com ou sem pontuação", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    const busca = janela().getByRole("searchbox", { name: "Buscar por razão social ou CNPJ" });
    await user.type(busca, "merc");
    expect(nomesNaTabela()).toEqual(["Mercado Ltda"]);
    await user.clear(busca);
    await user.type(busca, "11.222.333");
    expect(nomesNaTabela()).toEqual(["Padaria Ltda"]);
    await user.clear(busca);
    await user.type(busca, "zzz");
    expect(janela().getByText("Nenhuma empresa encontrada.")).toBeInTheDocument();
  });

  it("ordena pela coluna clicada, e clicar de novo inverte", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    const empresa = janela().getByRole("columnheader", { name: /Empresa/ });
    expect(empresa).toHaveAttribute("aria-sort", "ascending");
    await user.click(within(empresa).getByRole("button"));
    expect(empresa).toHaveAttribute("aria-sort", "descending");
    expect(nomesNaTabela()).toEqual(["Padaria Ltda", "Mercado Ltda"]);
    await user.click(within(janela().getByRole("columnheader", { name: /CNPJ/ })).getByRole("button"));
    // 11.222... vem antes de 11.444...
    expect(nomesNaTabela()).toEqual(["Padaria Ltda", "Mercado Ltda"]);
  });

  it("mostra 20 por página, e a busca volta à primeira", async () => {
    const user = userEvent.setup();
    const empresas = muitas(45);
    montar(empresas);
    await user.click(screen.getByRole("button", { name: /Empresa 01/ }));
    expect(nomesNaTabela()).toHaveLength(20);
    expect(janela().getByText("1 / 3")).toBeInTheDocument();
    expect(janela().getByRole("button", { name: "Anterior" })).toBeDisabled();
    await user.click(janela().getByRole("button", { name: "Próxima" }));
    await user.click(janela().getByRole("button", { name: "Próxima" }));
    expect(nomesNaTabela()).toEqual(["Empresa 41", "Empresa 42", "Empresa 43", "Empresa 44", "Empresa 45"]);
    // "4" casa com a razão social e com o CNPJ que tem o dígito: 04, 14, 24, 34 e 40 a 45
    await user.type(janela().getByRole("searchbox"), "Empresa 4");
    expect(janela().queryByRole("button", { name: "Próxima" })).not.toBeInTheDocument();
    expect(nomesNaTabela()).toHaveLength(10);
  });

  it("leva à tela Empresas pelo botão de gerenciar, e a janela fecha", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    const gerenciar = janela().getByRole("link", { name: "Gerenciar empresas" });
    expect(gerenciar).toHaveAttribute("href", `/e/${A.id}/empresas`);
    await user.click(gerenciar);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

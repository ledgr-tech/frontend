import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
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

/** N empresas, a primeira com a razão social "Empresa 01" e assim por diante. */
function muitas(n: number): EmpresaDaConta[] {
  return Array.from({ length: n }, (_, i) => {
    const numero = String(i + 1).padStart(2, "0");
    return { id: `00000000-0000-4000-8000-0000000000${numero}`, razaoSocial: `Empresa ${numero}`, cnpj: `${numero}222333000181` };
  });
}

beforeEach(() => {
  caminho.atual = `/e/${A.id}/fechamentos`;
  vi.clearAllMocks();
});

afterEach(() => {
  document.cookie = "ledgr-empresa-recente=; Path=/; Max-Age=0";
});

describe("SeletorDeEmpresa", () => {
  it("com uma empresa só, não aparece", () => {
    const { container } = montar([A]);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a empresa ativa, com o CNPJ formatado, num botão que abre uma lista", () => {
    montar();
    const botao = screen.getByRole("button", { name: /Padaria Ltda/ });
    expect(botao).toHaveAttribute("aria-haspopup", "listbox");
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(botao).toHaveTextContent("11.222.333/0001-81");
  });

  it("abre a lista com as empresas da conta, a ativa marcada", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));

    expect(screen.getByRole("button", { name: /Padaria Ltda/ })).toHaveAttribute("aria-expanded", "true");
    const lista = screen.getByRole("listbox", { name: "Empresas" });
    const opcoes = screen.getAllByRole("option");
    expect(lista).toContainElement(opcoes[0]);
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
      expect.stringContaining("Padaria Ltda"),
      expect.stringContaining("Mercado Ltda"),
    ]);
    expect(screen.getByRole("option", { name: /Padaria Ltda/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Mercado Ltda/ })).toHaveAttribute("aria-selected", "false");
  });

  it("trocar leva à mesma tela da outra empresa, lembra a escolha e fecha a lista", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.click(screen.getByRole("option", { name: /Mercado Ltda/ }));

    expect(roteador.push).toHaveBeenCalledWith(`/e/${B.id}/fechamentos`);
    expect(document.cookie).toContain(`ledgr-empresa-recente=${B.id}`);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("de uma tela com id (a comparação), vai à raiz da seção, porque o id não existe no outro cliente", async () => {
    caminho.atual = `/e/${A.id}/conciliacoes/${A.id}`;
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.click(screen.getByRole("option", { name: /Mercado Ltda/ }));

    expect(roteador.push).toHaveBeenCalledWith(`/e/${B.id}/dashboard`);
  });

  it("escolher a própria empresa ativa só fecha a lista", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    await user.click(screen.getByRole("option", { name: /Padaria Ltda/ }));

    expect(roteador.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Escape fecha a lista e devolve o foco ao botão", async () => {
    const user = userEvent.setup();
    montar();
    const botao = screen.getByRole("button", { name: /Padaria Ltda/ });
    await user.click(botao);
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it("as setas andam pelas opções e Enter escolhe", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    // a lista abre com o foco na empresa ativa
    expect(screen.getByRole("option", { name: /Padaria Ltda/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: /Mercado Ltda/ })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(roteador.push).toHaveBeenCalledWith(`/e/${B.id}/fechamentos`);
  });

  it("até 8 empresas não há busca; com 9, há, e ela filtra por razão social e por CNPJ", async () => {
    const user = userEvent.setup();
    const { unmount } = montar(muitas(8));
    await user.click(screen.getByRole("button", { name: /Empresa 01/ }));
    expect(screen.queryByLabelText("Buscar empresa")).not.toBeInTheDocument();
    unmount();

    montar(muitas(9));
    await user.click(screen.getByRole("button", { name: /Empresa 01/ }));
    const busca = screen.getByLabelText("Buscar empresa");
    await user.type(busca, "empresa 07");
    expect(screen.getAllByRole("option").map((opcao) => opcao.textContent)).toEqual([expect.stringContaining("Empresa 07")]);

    await user.clear(busca);
    await user.type(busca, "09.222.333");
    expect(screen.getAllByRole("option").map((opcao) => opcao.textContent)).toEqual([expect.stringContaining("Empresa 09")]);

    await user.clear(busca);
    await user.type(busca, "nenhuma");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nenhuma empresa encontrada.")).toBeInTheDocument();
  });

  it("o botão aponta para a lista (aria-controls) e o foco que sai do seletor a fecha", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ProvedorDaEmpresa ativa={A} empresas={[A, B]}>
          <SeletorDeEmpresa />
        </ProvedorDaEmpresa>
        <button type="button">Fora</button>
      </>,
    );
    const botao = screen.getByRole("button", { name: /Padaria Ltda/ });
    await user.click(botao);
    expect(botao).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    act(() => screen.getByRole("button", { name: "Fora" }).focus());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Home e End vão à primeira e à última opção", async () => {
    const user = userEvent.setup();
    montar([A, B, { ...B, id: "11111111-1111-4111-8111-111111111111", razaoSocial: "Zeta Ltda" }]);
    await user.click(screen.getByRole("button", { name: /Padaria Ltda/ }));
    const opcoes = screen.getAllByRole("option");
    await user.keyboard("{End}");
    expect(opcoes[opcoes.length - 1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(opcoes[0]).toHaveFocus();
  });
});

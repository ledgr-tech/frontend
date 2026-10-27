import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvedorDaEmpresa, type EmpresaDaConta } from "./empresa-ativa";
import { useRoteador } from "./roteador";

const roteador = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => roteador }));

const A: EmpresaDaConta = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181" };
const B_ID = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function Botoes() {
  const r = useRoteador();
  return (
    <>
      <button onClick={() => r.push("/extratos")}>push extratos</button>
      <button onClick={() => r.push("/login")}>push login</button>
      <button onClick={() => r.push(`/e/${B_ID}/extratos`)}>push outra</button>
      <button onClick={() => r.replace("/fechamentos?mes=2026-09")}>replace</button>
      <button onClick={() => r.prefetch("/historico")}>prefetch</button>
      <button onClick={() => r.refresh()}>refresh</button>
      <button onClick={() => r.back()}>back</button>
    </>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("useRoteador", () => {
  it("dentro do provedor, prefixa push, replace e prefetch com a empresa ativa", async () => {
    const user = userEvent.setup();
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A]}>
        <Botoes />
      </ProvedorDaEmpresa>,
    );
    await user.click(screen.getByText("push extratos"));
    await user.click(screen.getByText("replace"));
    await user.click(screen.getByText("prefetch"));
    expect(roteador.push).toHaveBeenCalledWith(`/e/${A.id}/extratos`);
    expect(roteador.replace).toHaveBeenCalledWith(`/e/${A.id}/fechamentos?mes=2026-09`);
    expect(roteador.prefetch).toHaveBeenCalledWith(`/e/${A.id}/historico`);
  });

  it("deixa como está o que não é tela da empresa, e não troca um prefixo que já existe", async () => {
    const user = userEvent.setup();
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A]}>
        <Botoes />
      </ProvedorDaEmpresa>,
    );
    await user.click(screen.getByText("push login"));
    await user.click(screen.getByText("push outra"));
    expect(roteador.push).toHaveBeenNthCalledWith(1, "/login");
    expect(roteador.push).toHaveBeenNthCalledWith(2, `/e/${B_ID}/extratos`);
  });

  it("refresh e back passam direto", async () => {
    const user = userEvent.setup();
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A]}>
        <Botoes />
      </ProvedorDaEmpresa>,
    );
    await user.click(screen.getByText("refresh"));
    await user.click(screen.getByText("back"));
    expect(roteador.refresh).toHaveBeenCalledTimes(1);
    expect(roteador.back).toHaveBeenCalledTimes(1);
  });

  it("sem empresa ativa (fora do provedor), não prefixa nada", async () => {
    const user = userEvent.setup();
    render(<Botoes />);
    await user.click(screen.getByText("push extratos"));
    expect(roteador.push).toHaveBeenCalledWith("/extratos");
  });
});

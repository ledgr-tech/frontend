import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvedorDaEmpresa, useEmpresaAtiva, useEmpresasDaConta, type EmpresaDaConta } from "./empresa-ativa";

const A: EmpresaDaConta = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181" };
const B: EmpresaDaConta = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "Mercado Ltda", cnpj: "11444777000161" };

function Mostra() {
  const ativa = useEmpresaAtiva();
  const todas = useEmpresasDaConta();
  return (
    <p data-testid="saida">
      {ativa?.razaoSocial ?? "nenhuma"}|{todas.map((empresa) => empresa.razaoSocial).join(",") || "vazio"}
    </p>
  );
}

describe("empresa ativa", () => {
  it("dentro do provedor, devolve a ativa e as empresas da conta", () => {
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A, B]}>
        <Mostra />
      </ProvedorDaEmpresa>,
    );
    expect(screen.getByTestId("saida")).toHaveTextContent("Padaria Ltda|Padaria Ltda,Mercado Ltda");
  });

  it("fora do provedor, não há empresa ativa e a lista é vazia", () => {
    render(<Mostra />);
    expect(screen.getByTestId("saida")).toHaveTextContent("nenhuma|vazio");
  });
});

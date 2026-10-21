import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProvedorDaEmpresa, type EmpresaDaConta } from "./empresa-ativa";
import LinkDoApp from "./link-do-app";

const A: EmpresaDaConta = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "Padaria Ltda", cnpj: "11222333000181" };
const B_ID = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

function href(caminho: string, dentro = true): string | null {
  const link = <LinkDoApp href={caminho}>ir</LinkDoApp>;
  render(dentro ? <ProvedorDaEmpresa ativa={A} empresas={[A]}>{link}</ProvedorDaEmpresa> : link);
  return screen.getByRole("link", { name: "ir" }).getAttribute("href");
}

describe("LinkDoApp", () => {
  it("prefixa as telas da empresa com a empresa ativa, mantendo a query", () => {
    expect(href("/fechamentos?mes=2026-09")).toBe(`/e/${A.id}/fechamentos?mes=2026-09`);
  });

  it("deixa como estão os caminhos que não são tela da empresa", () => {
    expect(href("/login")).toBe("/login");
  });

  it("não troca o prefixo de um caminho que já tem empresa", () => {
    expect(href(`/e/${B_ID}/extratos`)).toBe(`/e/${B_ID}/extratos`);
  });

  it("sem empresa ativa (fora do provedor), o href passa sem mudança", () => {
    expect(href("/fechamentos", false)).toBe("/fechamentos");
  });

  it("um href que não é texto passa sem mudança", () => {
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A]}>
        <LinkDoApp href={{ pathname: "/fechamentos" }}>ir</LinkDoApp>
      </ProvedorDaEmpresa>,
    );
    expect(screen.getByRole("link", { name: "ir" })).toHaveAttribute("href", "/fechamentos");
  });
});

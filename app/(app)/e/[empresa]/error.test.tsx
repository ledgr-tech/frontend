import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProvedorDaEmpresa } from "@/lib/empresa-ativa";
import ErroNoApp from "./error";

const A = { id: "3f1c0d5e-8a42-4b77-9c31-0d9e4a6f1b20", razaoSocial: "A", cnpj: "" };
const B = { id: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", razaoSocial: "B", cnpj: "" };

describe("ErroNoApp", () => {
  it("volta à Visão geral da empresa ativa na aba", () => {
    render(
      <ProvedorDaEmpresa ativa={A} empresas={[A, B]}>
        <ErroNoApp error={new Error("falha")} retry={vi.fn()} />
      </ProvedorDaEmpresa>,
    );
    expect(screen.getByRole("link", { name: "Ir para a visão geral" })).toHaveAttribute("href", `/e/${A.id}/visao-geral`);
  });

  it("usa o caminho geral fora do provedor de empresa", () => {
    render(<ErroNoApp error={new Error("falha")} retry={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Ir para a visão geral" })).toHaveAttribute("href", "/visao-geral");
  });
});

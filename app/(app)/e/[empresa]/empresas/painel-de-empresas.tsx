"use client";

import type { EmpresaCliente } from "@/lib/adaptadores";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";

/** O que a pessoa vê e faz na tela Empresas; a Task seguinte traz o plano, o Abrir e o cadastro. */
export function PainelDeEmpresas({ empresas }: { empresas: EmpresaCliente[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Empresa</th>
          <th scope="col">CNPJ</th>
        </tr>
      </thead>
      <tbody>
        {empresas.map((empresa) => (
          <tr key={empresa.id}>
            <td>{empresa.razaoSocial}</td>
            <td>{formatarCnpj(empresa.cnpj)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

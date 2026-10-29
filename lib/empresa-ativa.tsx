"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/** Uma empresa da conta, como o seletor a mostra: o `razao_social` e o `cnpj` vêm do `GET /me`. */
export type EmpresaDaConta = { id: string; razaoSocial: string; cnpj: string };

type Valor = { ativa: EmpresaDaConta; empresas: EmpresaDaConta[] };

const Contexto = createContext<Valor | null>(null);

/**
 * A empresa que a aba está vendo (a da URL, `/e/<uuid>/...`) e as demais da conta. Quem monta é o layout
 * de `app/(app)/e/[empresa]`; fora dele (a vitrine da landing, os testes) não há empresa ativa.
 */
export function ProvedorDaEmpresa({
  ativa,
  empresas,
  children,
}: {
  ativa: EmpresaDaConta;
  empresas: EmpresaDaConta[];
  children: ReactNode;
}) {
  const valor = useMemo(() => ({ ativa, empresas }), [ativa, empresas]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** A empresa ativa da aba; null fora do provedor. */
export function useEmpresaAtiva(): EmpresaDaConta | null {
  return useContext(Contexto)?.ativa ?? null;
}

/** Todas as empresas da conta, para o seletor; vazio fora do provedor. */
export function useEmpresasDaConta(): EmpresaDaConta[] {
  return useContext(Contexto)?.empresas ?? [];
}

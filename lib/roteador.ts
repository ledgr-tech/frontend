"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useEmpresaAtiva } from "./empresa-ativa";
import { comEmpresa } from "./rotas";

type Opcoes = Parameters<ReturnType<typeof useRouter>["push"]>[1];

/**
 * O `useRouter` do Next para dentro do app: `push`, `replace` e `prefetch` prefixam as telas da empresa
 * com a empresa da aba, como o `LinkDoApp`; um caminho que já tem `/e/<uuid>` segue como veio (é assim
 * que o seletor leva a outra empresa). `refresh` e `back` passam direto.
 */
export function useRoteador() {
  const router = useRouter();
  const empresa = useEmpresaAtiva()?.id;
  return useMemo(() => {
    const alvo = (href: string) => (empresa ? comEmpresa(empresa, href) : href);
    return {
      // as opções vão só quando existem: quem confere a chamada de um argumento (os testes do app) segue valendo
      push: (href: string, opcoes?: Opcoes) => (opcoes ? router.push(alvo(href), opcoes) : router.push(alvo(href))),
      replace: (href: string, opcoes?: Opcoes) => (opcoes ? router.replace(alvo(href), opcoes) : router.replace(alvo(href))),
      prefetch: (href: string) => router.prefetch(alvo(href)),
      refresh: () => router.refresh(),
      back: () => router.back(),
    };
  }, [router, empresa]);
}

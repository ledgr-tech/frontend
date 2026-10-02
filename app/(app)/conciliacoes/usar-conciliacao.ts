"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pareceUuid } from "@/lib/adaptadores";
import { buscarConciliacao, type Conciliacao } from "@/lib/mock-data";
import type { Mudancas } from "@/lib/rodadas";
import { carregarConciliacaoEmRodadas, type RodadaVista } from "./acoes";

/**
 * Carrega uma conciliação, venha ela do backend ou do mock — e diz de onde veio.
 *
 * As duas telas que mostram uma conciliação (a tabela e o detalhe de uma linha)
 * precisam da mesma decisão, então ela mora num lugar só. O id é quem decide:
 * UUID é extrato de verdade, "conc-1" é o mock que ainda alimenta a dashboard e
 * o histórico enquanto o backend não tem endpoint pra listar conciliações.
 *
 * `real` importa pra tela: as ações que gravam (fechar a conciliação, aceitar o
 * valor do banco) existem só no mock. O backend não tem endpoint pra alterar o
 * resultado da conciliação, então com dado real a tela é de leitura — melhor do
 * que um botão que parece funcionar e não persiste nada.
 */
export type EstadoConciliacao =
  | { situacao: "carregando" }
  | { situacao: "ausente" }
  | { situacao: "falhou" }
  | {
      situacao: "pronta";
      conciliacao: Conciliacao;
      real: boolean;
      truncada: boolean;
      /** A rodada aberta; null no mock e quando o extrato não aparece nas execuções. */
      rodada: RodadaVista | null;
      mudancas: Mudancas | null;
    };

/**
 * A Server Action lançou em vez de devolver um Resultado (rede caída, deploy
 * novo no meio). Não é "não encontrada": recarregar costuma resolver.
 */
export const FALHA_AO_CARREGAR =
  "Não foi possível carregar a conciliação. Recarregue a página e tente de novo.";

/**
 * `sistema` é o extrato do sistema da rodada, lido de `?sistema=` na URL; sem ele,
 * abre a rodada mais recente do extrato do banco.
 */
export function useConciliacao(
  id: string,
  sistema?: string,
): {
  estado: EstadoConciliacao;
  substituir: (conciliacao: Conciliacao | ((atual: Conciliacao) => Conciliacao)) => void;
  /** Carrega de novo: depois de uma rodada nova, a URL pode não ter mudado. */
  recarregar: () => void;
} {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoConciliacao>({ situacao: "carregando" });
  const [vez, setVez] = useState(0);

  // O router fica numa ref, e fora das dependências: se ele trocar de
  // identidade entre renders, o efeito recarregaria a conciliação a cada render
  // — e como ele escreve estado, isso é um laço que não para. O único uso dele
  // aqui é redirecionar num 401, que não precisa reagir a mudança nenhuma.
  const irPara = useRef(router);
  useEffect(() => {
    irPara.current = router;
  });

  useEffect(() => {
    if (!pareceUuid(id)) {
      const mock = buscarConciliacao(id);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado(
        mock
          ? { situacao: "pronta", conciliacao: mock, real: false, truncada: false, rodada: null, mudancas: null }
          : { situacao: "ausente" },
      );
      return;
    }

    let cancelado = false;
    carregarConciliacaoEmRodadas(id, sistema).then(
      (resposta) => {
        if (cancelado) return;
        if (!resposta.ok) {
          if (resposta.status === 401) irPara.current.push("/login");
          setEstado({ situacao: "ausente" });
          return;
        }
        setEstado({
          situacao: "pronta",
          conciliacao: resposta.dados.conciliacao,
          real: true,
          truncada: resposta.dados.truncada,
          rodada: resposta.dados.rodada,
          mudancas: resposta.dados.mudancas,
        });
      },
      () => {
        if (!cancelado) setEstado({ situacao: "falhou" });
      },
    );
    return () => {
      cancelado = true;
    };
  }, [id, sistema, vez]);

  /**
   * Depois de uma ação do mock, que devolve a conciliação já atualizada. Ou uma
   * função da que estiver na tela: a resposta que chega depois de outra mudança
   * (a caixa de outra linha) mexe só na linha dela.
   */
  function substituir(conciliacao: Conciliacao | ((atual: Conciliacao) => Conciliacao)) {
    setEstado((atual) =>
      atual.situacao === "pronta"
        ? { ...atual, conciliacao: typeof conciliacao === "function" ? conciliacao(atual.conciliacao) : conciliacao }
        : atual,
    );
  }

  return { estado, substituir, recarregar: () => setVez((atual) => atual + 1) };
}

"use client";

import LinkDoApp from "@/lib/link-do-app";
import { useCobranca } from "../conta";

/**
 * A faixa do plano no alto de cada aba da tela Empresas: quanto a conta já usa, a barra de uso (só com
 * máximo) e o aviso do limite. No limite, e acima dele, a barra fica na cor de risco e há o caminho
 * para os planos.
 */
export function FaixaDoPlano({
  contagem,
  usadas,
  maximo,
  aviso,
  verPlanos,
}: {
  /** "2 de 3 empresas", ou só "2 empresas" sem máximo. */
  contagem: string;
  usadas: number;
  maximo: number | null;
  aviso: string | null;
  verPlanos: boolean;
}) {
  const cobranca = useCobranca();
  const noLimite = maximo !== null && usadas >= maximo;
  return (
    <div className="faixa-plano">
      <strong>{contagem}</strong>
      {maximo !== null && (
        <span className="faixa-plano-barra" data-no-limite={noLimite ? "true" : undefined} aria-hidden="true">
          <i style={{ width: `${maximo === 0 ? 100 : Math.min(100, Math.round((usadas / maximo) * 100))}%` }} />
        </span>
      )}
      {aviso && <span>{aviso}</span>}
      {verPlanos && cobranca && (
        <LinkDoApp href="/assinatura" className="btn btn-secondary">
          Ver planos
        </LinkDoApp>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { abrirConfiguracoes } from "@/lib/eventos";
import { useAssinatura, usePreferencias } from "../conta";
import type { PassoDoRoteiro } from "./roteiro";

/** A faixa de primeiros passos no topo da Visão geral, até a pessoa terminar ou dispensar. */
export function RoteiroFaixa({
  passos: todos,
  alternativa,
}: {
  passos: PassoDoRoteiro[];
  alternativa: ReactNode;
}) {
  const { carregado, roteiroDispensado, dispensarRoteiro } = usePreferencias();
  // sem a situação da conta no /me (o backend de hoje), não há teste começado para mostrar
  const passos = useAssinatura() ? todos : todos.filter((passo) => passo.id !== "plano");
  if (!carregado) return null;
  if (roteiroDispensado) return <>{alternativa}</>;
  const feitos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);

  return (
    <section
      className="card roteiro"
      aria-labelledby="roteiro-titulo"
      data-tutorial="roteiro"
    >
      <div className="roteiro-topo">
        <div className="roteiro-cabeca">
          <h2 id="roteiro-titulo" className="roteiro-titulo">
            Primeiros passos
          </h2>
          <span className="roteiro-sub">
            Do primeiro extrato ao mês fechado.
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={dispensarRoteiro}
        >
          Já sei usar
        </button>
      </div>
      <div className="roteiro-progresso">
        <div
          role="progressbar"
          aria-label="Primeiros passos feitos"
          aria-valuemin={0}
          aria-valuemax={passos.length}
          aria-valuenow={feitos}
          className="roteiro-barra"
        >
          <span style={{ width: `${(feitos / passos.length) * 100}%` }} />
        </div>
        <span className="roteiro-conta">{`${feitos} de ${passos.length}`}</span>
      </div>
      <ol className="roteiro-passos">
        {passos.map((passo, i) => {
          const agora = passo === proximo;
          return (
            <li
              key={passo.id}
              className="roteiro-passo"
              data-feito={passo.feito || undefined}
              data-agora={agora || undefined}
            >
              <span className="roteiro-marca" aria-hidden="true">
                {passo.feito ? <Check size={15} /> : i + 1}
              </span>
              <span className="roteiro-texto">
                <span className="roteiro-passo-titulo">
                  {passo.titulo}
                  {passo.feito && <span className="sr-only"> (feito)</span>}
                </span>
                <span className="roteiro-passo-detalhe">{passo.texto}</span>
              </span>
              {agora && passo.destino?.tipo === "configuracoes" && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => abrirConfiguracoes("conciliacao")}
                >
                  Definir agora
                  <ArrowRight size={15} />
                </button>
              )}
              {agora && passo.destino?.tipo === "link" && (
                <Link href={passo.destino.href} className="btn btn-primary">
                  Fazer agora
                  <ArrowRight size={15} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

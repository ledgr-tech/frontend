"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/app/reveal";
import { listarRegras, tomDaRegra, type Regra } from "@/lib/mock-data";
import { Barra, EsqueletoTela } from "../esqueleto";
import { Cabecalho } from "../cabecalho";

type Listas = { ativas: Regra[]; sugeridas: Regra[] };

// ponytail: o design põe aqui "Ajustar tolerância geral" (→ configurações) e
// "Ver aplicações" (→ trilha de auditoria). Nenhuma das duas telas existe nesta
// branch, então os botões ficam de fora em vez de linkarem para o vazio.

/**
 * As regras são de demonstração: o backend não guarda regra nenhuma. Como na
 * Assinatura, nada aqui finge que salvou — os botões aparecem desligados e
 * apontam para o aviso que diz por quê. Com a rota de regras, eles voltam.
 */
const AVISO_ID = "regras-aviso";

export default function RegrasPage() {
  const [listas, setListas] = useState<Listas | null>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListas(listarRegras());
  }, []);

  if (listas === null) {
    return (
      <EsqueletoTela>
        {[0, 1].map((i) => (
          <div key={i} className="regra-cartao">
            <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              <Barra largura={260} altura={18} />
              <Barra />
              <Barra largura="72%" />
            </div>
          </div>
        ))}
      </EsqueletoTela>
    );
  }

  return (
    <div>
      <Cabecalho
        titulo="Regras"
        contexto={[
          `${listas.ativas.length} ${listas.ativas.length === 1 ? "ativa" : "ativas"}`,
          `${listas.sugeridas.length} ${listas.sugeridas.length === 1 ? "sugerida" : "sugeridas"}`,
        ]}
      />

      <div className="regras-corpo">
        <p id={AVISO_ID} role="note" className="aviso-demonstracao">
          <strong>As regras ainda não estão no ar.</strong> As regras desta tela são de demonstração, e
          nada é alterado por aqui.
        </p>

        <Reveal>
          <h3 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 600 }}>Ativas</h3>
          {listas.ativas.length === 0 ? (
            <p className="regras-vazio">
              Nenhuma regra ativa. As sugestões abaixo saíram de padrões que repetiram.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {listas.ativas.map((regra) => (
                <div key={regra.id} className="regra-cartao">
                  <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <div className="regra-titulo-linha">
                      <span
                        style={{
                          fontSize: 19,
                          fontWeight: 600,
                          lineHeight: 1.26,
                        }}
                      >
                        {regra.titulo}
                      </span>
                      <span className={`selo selo-${tomDaRegra(regra.marca)}`}>{regra.marca}</span>
                    </div>
                    <div className="regra-texto">{regra.texto}</div>
                    <div className="regra-rodape">{regra.rodape}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ flex: "none", fontSize: 13.5 }}
                    disabled
                    aria-describedby={AVISO_ID}
                  >
                    Desativar
                  </button>
                </div>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delay={0.08}>
          <div className="regras-sugeridas-topo">
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Sugeridas pelo Ledgr</h3>
            <span
              style={{ fontSize: 13.5, color: "color-mix(in srgb, var(--color-text) 58%, transparent)" }}
            >
              Padrões que repetiram em três meses ou mais.
            </span>
          </div>
          {listas.sugeridas.length === 0 ? (
            <p className="regras-vazio">
              Todas as sugestões já viraram regra. Novos padrões aparecem aqui quando repetirem.
            </p>
          ) : (
            <div style={{ borderTop: "1px solid var(--color-divider)" }}>
              {listas.sugeridas.map((regra) => (
                <div key={regra.id} className="regra-sugerida">
                  <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.26,
                        marginBottom: 6,
                      }}
                    >
                      {regra.titulo}
                    </div>
                    <div className="regra-texto">{regra.texto}</div>
                  </div>
                  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="regra-impacto">{regra.impacto}</span>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: 13.5 }}
                      disabled
                      aria-describedby={AVISO_ID}
                    >
                      Criar regra
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>
    </div>
  );
}

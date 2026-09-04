"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";

export type LinhaExtrato = {
  data: string;
  desc: string;
  valorBanco: string | null;
  valorSistema: string | null;
  status: "Batido" | "Sem correspondente" | "Valor divergente" | "Data divergente";
  explicacao: string | null;
};

function Painel({
  titulo,
  arquivo,
  linhas,
  valorDe,
  onAbrir,
}: {
  titulo: string;
  arquivo: string;
  linhas: LinhaExtrato[];
  valorDe: (linha: LinhaExtrato) => string | null;
  onAbrir: (linha: LinhaExtrato) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", overflow: "hidden" }}>
      <div
        style={{
          padding: "13px 18px",
          borderBottom: "1px solid var(--color-divider)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 600 }}>{titulo}</span>
        <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>{arquivo}</span>
      </div>
      {linhas.map((linha) => {
        const clicavel = linha.status !== "Batido";
        const conteudo = (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ flex: "none", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>{linha.data}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {linha.desc}
              </span>
              <span style={{ flex: "none", fontFamily: "var(--font-heading)", fontSize: 16.5, fontWeight: 600 }}>{valorDe(linha)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span className={linha.status === "Batido" ? "tag tag-accent" : "tag tag-outline"}>{linha.status}</span>
            </div>
          </>
        );
        const rowStyle = {
          display: "flex" as const,
          flexDirection: "column" as const,
          gap: 6,
          width: "100%",
          padding: "10px 18px",
          borderBottom: "1px solid var(--color-divider)",
        };

        if (!clicavel) {
          return (
            <div key={linha.desc} style={rowStyle}>
              {conteudo}
            </div>
          );
        }

        return (
          <button
            key={linha.desc}
            type="button"
            onClick={() => onAbrir(linha)}
            style={{
              ...rowStyle,
              background: "transparent",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              font: "inherit",
              textAlign: "left",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            {conteudo}
          </button>
        );
      })}
    </div>
  );
}

export function ExtratoComparacao({ banco, sistema }: { banco: LinhaExtrato[]; sistema: LinhaExtrato[] }) {
  const [aberta, setAberta] = useState<LinhaExtrato | null>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberta) return;

    fecharRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberta(null);
      if (event.key === "Tab") {
        event.preventDefault();
        fecharRef.current?.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta]);

  return (
    <>
      <div className="extrato-grid" style={{ display: "grid", gap: 28, alignItems: "stretch" }}>
        <Painel titulo="Extrato do banco" arquivo="extrato-08.ofx" linhas={banco} valorDe={(l) => l.valorBanco} onAbrir={setAberta} />
        <div className="extrato-divider">
          <div className="extrato-divider-line" />
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, color: "var(--color-accent)" }}>≠</div>
          <div className="extrato-divider-line" />
        </div>
        <Painel titulo="Extrato do sistema" arquivo="razao-08.csv" linhas={sistema} valorDe={(l) => l.valorSistema} onAbrir={setAberta} />
      </div>

      <AnimatePresence>
        {aberta && (
          <m.div
            onClick={() => setAberta(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "color-mix(in srgb, var(--color-neutral-900) 32%, transparent)",
            }}
          >
            <m.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="divergencia-titulo"
              onClick={(event) => event.stopPropagation()}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                height: "100%",
                width: "min(360px, 100%)",
                borderLeft: "1px solid var(--color-divider)",
                background: "var(--color-surface)",
                boxShadow: "var(--shadow-lg)",
                padding: "30px 26px 40px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              <div>
                <h6 style={{ margin: "0 0 10px", color: "var(--color-accent-700)" }}>
                  Lançamento · {aberta.status}
                </h6>
                <div
                  id="divergencia-titulo"
                  style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 600, lineHeight: 1.24, marginBottom: 12 }}
                >
                  {aberta.desc}
                </div>
                <div style={{ display: "flex", flexDirection: "column", borderTop: "1px solid var(--color-divider)" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 14,
                      padding: "9px 0",
                      borderBottom: "1px solid var(--color-divider)",
                      fontSize: 13.5,
                    }}
                  >
                    <span style={{ flex: "none", color: "color-mix(in srgb, var(--color-text) 56%, transparent)" }}>
                      Extrato do banco
                    </span>
                    <span>{aberta.valorBanco ?? "—"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 14,
                      padding: "9px 0",
                      borderBottom: "1px solid var(--color-divider)",
                      fontSize: 13.5,
                    }}
                  >
                    <span style={{ flex: "none", color: "color-mix(in srgb, var(--color-text) 56%, transparent)" }}>
                      Extrato do sistema
                    </span>
                    <span>{aberta.valorSistema ?? "—"}</span>
                  </div>
                </div>
              </div>
              {aberta.explicacao && <p className="dialog-body">{aberta.explicacao}</p>}
              <div style={{ marginTop: "auto" }}>
                <button type="button" ref={fecharRef} className="btn btn-ghost" onClick={() => setAberta(null)}>
                  Fechar
                </button>
              </div>
            </m.aside>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

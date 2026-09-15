"use client";

import { AnimatePresence, m } from "motion/react";
import { useId, useState } from "react";

export type LinhaExtrato = {
  data: string;
  desc: string;
  valorBanco: string | null;
  valorSistema: string | null;
  status: "Batido" | "Sem correspondente" | "Valor divergente" | "Data divergente";
  explicacao: string | null;
};

function Detalhe({ id, linha }: { id: string; linha: LinhaExtrato }) {
  const valorStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: "7px 0",
    borderBottom: "1px solid var(--color-divider)",
    fontSize: 13.5,
  };
  const rotuloStyle = { flex: "none", color: "color-mix(in srgb, var(--color-text) 56%, transparent)" };

  return (
    <m.div
      id={id}
      role="tooltip"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      style={{
        // ponytail: abre sempre acima da linha — abaixo, a última linha invade a seção seguinte.
        position: "absolute",
        bottom: "calc(100% - 4px)",
        right: 12,
        zIndex: 20,
        width: "min(340px, calc(100% - 24px))",
        padding: "16px 18px",
        border: "1px solid var(--color-divider)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Lançamento · {linha.status}</h6>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600, lineHeight: 1.24, marginBottom: 10 }}>
          {linha.desc}
        </div>
        <div style={{ borderTop: "1px solid var(--color-divider)" }}>
          <div style={valorStyle}>
            <span style={rotuloStyle}>Extrato do banco</span>
            <span>{linha.valorBanco ?? "—"}</span>
          </div>
          <div style={valorStyle}>
            <span style={rotuloStyle}>Extrato do sistema</span>
            <span>{linha.valorSistema ?? "—"}</span>
          </div>
        </div>
      </div>
      {linha.explicacao && (
        <p className="dialog-body" style={{ margin: 0, lineHeight: 1.6 }}>
          {linha.explicacao}
        </p>
      )}
    </m.div>
  );
}

type Lado = "banco" | "sistema";
type Ativa = { lado: Lado; desc: string } | null;

function Painel({
  lado,
  titulo,
  arquivo,
  linhas,
  ativa,
  setAtiva,
}: {
  lado: Lado;
  titulo: string;
  arquivo: string;
  linhas: LinhaExtrato[];
  ativa: Ativa;
  setAtiva: (atualizar: (atual: Ativa) => Ativa) => void;
}) {
  const baseId = useId();
  const valorDe = (linha: LinhaExtrato) => (lado === "banco" ? linha.valorBanco : linha.valorSistema);

  return (
    <div style={{ border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", background: "var(--color-surface)" }}>
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
      {linhas.map((linha, i) => {
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
          // a borda do painel já fecha a última linha
          borderBottom: i === linhas.length - 1 ? "none" : "1px solid var(--color-divider)",
        };

        if (linha.status === "Batido") {
          return (
            <div key={linha.desc} style={rowStyle}>
              {conteudo}
            </div>
          );
        }

        // o par é casado pela descrição — é o que o Ledgr mostra dos dois lados
        const aberta = ativa?.lado === lado && ativa.desc === linha.desc;
        const correspondente = ativa !== null && ativa.lado !== lado && ativa.desc === linha.desc;
        const id = `${baseId}-${i}`;
        const abrir = () => setAtiva(() => ({ lado, desc: linha.desc }));
        const fechar = () => setAtiva((atual) => (atual?.lado === lado && atual.desc === linha.desc ? null : atual));

        return (
          <div key={linha.desc} style={{ position: "relative" }} onMouseEnter={abrir} onMouseLeave={fechar}>
            <button
              type="button"
              aria-describedby={aberta ? id : undefined}
              data-correspondente={correspondente || undefined}
              onFocus={abrir}
              onBlur={fechar}
              // toque não tem hover: o tap abre, tocar fora (blur) fecha
              onClick={abrir}
              onKeyDown={(event) => event.key === "Escape" && fechar()}
              style={{
                ...rowStyle,
                background: aberta
                  ? "color-mix(in srgb, var(--color-accent-300) 12%, transparent)"
                  : correspondente
                    ? "color-mix(in srgb, var(--color-accent-300) 6%, transparent)"
                    : "transparent",
                borderTop: "none",
                borderLeft: "none",
                borderRight: "none",
                font: "inherit",
                textAlign: "left",
                cursor: "help",
                color: "inherit",
                transition: "background 0.15s",
              }}
            >
              {conteudo}
            </button>
            <AnimatePresence>{aberta && <Detalhe id={id} linha={linha} />}</AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function ExtratoComparacao({ banco, sistema }: { banco: LinhaExtrato[]; sistema: LinhaExtrato[] }) {
  const [ativa, setAtiva] = useState<Ativa>(null);

  return (
    <div className="extrato-grid" style={{ display: "grid", gap: 28, alignItems: "stretch" }}>
      <Painel lado="banco" titulo="Extrato do banco" arquivo="extrato-08.ofx" linhas={banco} ativa={ativa} setAtiva={setAtiva} />
      <div className="extrato-divider">
        <div className="extrato-divider-line" />
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 28, color: "var(--color-accent)" }}>≠</div>
        <div className="extrato-divider-line" />
      </div>
      <Painel lado="sistema" titulo="Extrato do sistema" arquivo="razao-08.csv" linhas={sistema} ativa={ativa} setAtiva={setAtiva} />
    </div>
  );
}

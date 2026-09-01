"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  buscarConciliacao,
  fecharConciliacao,
  formatarMoeda,
  type Conciliacao,
  type LinhaComparacao,
} from "@/lib/mock-data";

const ROTULO_STATUS: Record<LinhaComparacao["status"], string> = {
  batido: "Batido",
  divergencia_valor: "Divergência de valor",
  somente_banco: "Só no banco",
  somente_sistema: "Só no sistema",
};

export default function ConciliacaoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [conciliacao, setConciliacao] = useState<Conciliacao | null | undefined>(undefined);
  const [linhaAberta, setLinhaAberta] = useState<LinhaComparacao | null>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConciliacao(buscarConciliacao(params.id));
  }, [params.id]);

  if (conciliacao === undefined) {
    return null;
  }

  if (conciliacao === null) {
    return (
      <div style={{ padding: "48px 0" }}>
        <p>Conciliação não encontrada.</p>
      </div>
    );
  }

  function fechar() {
    const atualizada = fecharConciliacao(conciliacao!.id);
    if (atualizada) setConciliacao(atualizada);
  }

  if (conciliacao.status === "fechada") {
    return (
      <Fechamento
        conciliacao={conciliacao}
        onNovaConciliacao={() => router.push("/conciliacoes/nova")}
      />
    );
  }

  return (
    <div style={{ padding: "28px 0 72px", display: "flex", flexDirection: "column", gap: 22 }}>
      <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600 }}>Comparação direta</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrição</th>
            <th style={{ textAlign: "right" }}>Banco</th>
            <th style={{ textAlign: "right" }}>Sistema</th>
            <th style={{ textAlign: "right" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {conciliacao.linhas.map((linha) => (
            <tr key={linha.id} onClick={() => setLinhaAberta(linha)} style={{ cursor: "pointer" }}>
              <td>{linha.data}</td>
              <td>{linha.descricao}</td>
              <td style={{ textAlign: "right" }}>
                {linha.valorBanco !== null ? formatarMoeda(linha.valorBanco) : "—"}
              </td>
              <td style={{ textAlign: "right" }}>
                {linha.valorSistema !== null ? formatarMoeda(linha.valorSistema) : "—"}
              </td>
              <td style={{ textAlign: "right" }}>
                <span className={linha.status === "batido" ? "tag tag-accent" : "tag tag-outline"}>
                  {ROTULO_STATUS[linha.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button type="button" className="btn btn-primary" onClick={fechar}>
          Fechar mês
        </button>
      </div>

      {linhaAberta && (
        <div className="dialog-backdrop" onClick={() => setLinhaAberta(null)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <span className="dialog-title">{linhaAberta.descricao}</span>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Extrato do banco</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600 }}>
                  {linhaAberta.valorBanco !== null ? formatarMoeda(linhaAberta.valorBanco) : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>Extrato do sistema</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 600 }}>
                  {linhaAberta.valorSistema !== null ? formatarMoeda(linhaAberta.valorSistema) : "—"}
                </div>
              </div>
            </div>
            {linhaAberta.explicacao && <p className="dialog-body">{linhaAberta.explicacao}</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Evento</th>
                </tr>
              </thead>
              <tbody>
                {linhaAberta.historico.map((evento) => (
                  <tr key={`${evento.quando}-${evento.evento}`}>
                    <td>{evento.quando}</td>
                    <td>{evento.evento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setLinhaAberta(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fechamento({
  conciliacao,
  onNovaConciliacao,
}: {
  conciliacao: Conciliacao;
  onNovaConciliacao: () => void;
}) {
  const total = conciliacao.linhas.length;
  const batidos = conciliacao.linhas.filter((linha) => linha.status === "batido").length;
  const pendentes = total - batidos;

  return (
    <div style={{ padding: "44px 0 64px", maxWidth: 1000, display: "flex", flexDirection: "column", gap: 34 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-accent-700)",
            marginBottom: 14,
          }}
        >
          Mês conciliado
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: 42, fontWeight: 400 }}>
          {pendentes === 0
            ? `${conciliacao.mes} fechou sem divergência pendente.`
            : `${conciliacao.mes} fechado com ${pendentes} ${pendentes === 1 ? "item revisado" : "itens revisados"}.`}
        </h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          borderTop: "1px solid var(--color-divider)",
          borderBottom: "1px solid var(--color-divider)",
        }}
      >
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>Lançamentos</span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{total}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>
            Batidos automaticamente
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{batidos}</span>
        </div>
        <div style={{ padding: "18px 0" }}>
          <span style={{ display: "block", fontSize: 12, textTransform: "uppercase" }}>
            Revisados manualmente
          </span>
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 34 }}>{pendentes}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNovaConciliacao}
          style={{ fontSize: 15, padding: "12px 22px" }}
        >
          Começar o próximo mês
        </button>
      </div>
    </div>
  );
}

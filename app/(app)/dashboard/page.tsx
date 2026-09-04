"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EMPRESA_MOCK, listarConciliacoes, type Conciliacao } from "@/lib/mock-data";

export default function DashboardPage() {
  const [conciliacoes, setConciliacoes] = useState<Conciliacao[] | null>(null);

  useEffect(() => {
    // localStorage is only readable client-side; this is the standard pattern for
    // deferring a client-only read out of the render phase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConciliacoes(listarConciliacoes());
  }, []);

  if (conciliacoes === null) {
    return null;
  }

  return (
    <div>
      <div
        style={{
          borderBottom: "1px solid var(--color-divider)",
          padding: "24px 0",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>{EMPRESA_MOCK}</h1>
          <span
            style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
          >
            Competência setembro/2026
          </span>
        </div>
        <Link href="/conciliacoes/nova" className="btn btn-primary">
          Novo extrato
        </Link>
      </div>

      {conciliacoes.length === 0 ? (
        <div
          style={{
            padding: "76px 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 400, maxWidth: "24ch" }}>
            Nenhum extrato por aqui ainda.
          </h2>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.75, maxWidth: "48ch" }}>
            Suba o extrato do banco e o extrato do sistema de gestão. A primeira conciliação fica
            pronta em poucos minutos.
          </p>
          <Link
            href="/conciliacoes/nova"
            className="btn btn-primary"
            style={{ fontSize: 15, padding: "12px 22px" }}
          >
            Fazer o primeiro upload
          </Link>
        </div>
      ) : (
        <div style={{ padding: "32px 0 56px" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 600 }}>
            Conciliações recentes
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Status</th>
                <th style={{ width: 110 }}>Lançamentos</th>
                <th style={{ width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {conciliacoes.map((conciliacao) => (
                <tr key={conciliacao.id}>
                  <td>{conciliacao.mes}</td>
                  <td>
                    <span
                      className={conciliacao.status === "fechada" ? "tag tag-accent" : "tag tag-outline"}
                    >
                      {conciliacao.status === "fechada" ? "Fechada" : "Em andamento"}
                    </span>
                  </td>
                  <td>{conciliacao.linhas.length}</td>
                  <td>
                    <Link href={`/conciliacoes/${conciliacao.id}`} className="btn btn-secondary">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

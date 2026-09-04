"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { criarConciliacao } from "@/lib/mock-data";

export default function NovaConciliacaoPage() {
  const router = useRouter();
  const [arquivoBanco, setArquivoBanco] = useState<File | null>(null);
  const [arquivoSistema, setArquivoSistema] = useState<File | null>(null);

  function selecionarBanco(event: ChangeEvent<HTMLInputElement>) {
    setArquivoBanco(event.target.files?.[0] ?? null);
  }

  function selecionarSistema(event: ChangeEvent<HTMLInputElement>) {
    setArquivoSistema(event.target.files?.[0] ?? null);
  }

  function conciliar() {
    const conciliacao = criarConciliacao();
    router.push(`/conciliacoes/${conciliacao.id}`);
  }

  const podeConciliar = arquivoBanco !== null && arquivoSistema !== null;

  return (
    <div style={{ padding: "36px 0 64px", maxWidth: 1040 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Nova conciliação</h1>
      <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
        Setembro/2026
      </span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
          margin: "24px 0",
        }}
      >
        <label
          className="card"
          style={{ cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do banco
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            {arquivoBanco ? arquivoBanco.name : "OFX ou CSV do banco"}
          </span>
          <input
            aria-label="Extrato do banco"
            type="file"
            accept=".ofx,.csv"
            onChange={selecionarBanco}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
        <label
          className="card"
          style={{ cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do sistema de gestão
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            {arquivoSistema ? arquivoSistema.name : "CSV exportado do seu sistema"}
          </span>
          <input
            aria-label="Extrato do sistema de gestão"
            type="file"
            accept=".csv"
            onChange={selecionarSistema}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
      </div>

      <div className="card" style={{ borderColor: "var(--color-accent)", marginBottom: 28 }}>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Regra de ouro</h6>
        <p style={{ margin: 0, fontSize: 14 }}>
          O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como
          &ldquo;o sistema diverge do banco&rdquo; — se o valor no seu sistema estiver diferente,
          é ele que precisa de ajuste.
        </p>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!podeConciliar}
        onClick={conciliar}
        style={{ fontSize: 15, padding: "12px 22px" }}
      >
        Conciliar extratos
      </button>
    </div>
  );
}

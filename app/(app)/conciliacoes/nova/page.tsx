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
      <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
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
          className="card cartao-arquivo"
          style={{ position: "relative", cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do banco
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            {arquivoBanco ? arquivoBanco.name : "Arquivo OFX ou CSV exportado do internet banking"}
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
          className="card cartao-arquivo"
          style={{ position: "relative", cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do sistema de gestão
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            {arquivoSistema ? arquivoSistema.name : "Arquivo CSV exportado do seu sistema de gestão"}
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

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!podeConciliar}
          aria-describedby={podeConciliar ? undefined : "nova-conciliacao-pendente"}
          onClick={conciliar}
          style={{ fontSize: 15, padding: "12px 22px" }}
        >
          Conciliar extratos
        </button>
        {!podeConciliar && (
          <span
            id="nova-conciliacao-pendente"
            style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}
          >
            Envie os dois extratos para conciliar.
          </span>
        )}
      </div>
    </div>
  );
}

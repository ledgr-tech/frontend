import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "84px 24px 72px",
        }}
      >
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-accent-700)",
          }}
        >
          Cap. I · O fechamento do mês
        </span>
        <h1 style={{ margin: "24px 0", fontSize: 56, fontWeight: 400, lineHeight: 1.05 }}>
          Pare de conciliar extrato à mão.
        </h1>
        <p style={{ margin: "0 0 34px", fontSize: 17.5, lineHeight: 1.72, maxWidth: "44ch" }}>
          Suba o extrato do banco e o extrato do seu sistema de gestão. Em minutos você recebe o
          relatório do que bate e do que não bate — lançamento por lançamento, sem planilha no
          meio.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <Link
            href="/login"
            className="btn btn-primary"
            style={{ fontSize: 15.5, padding: "13px 24px" }}
          >
            Conciliar meu primeiro extrato
          </Link>
          <span
            style={{
              fontSize: 14,
              color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
            }}
          >
            OFX ou CSV · sem cartão de crédito
          </span>
        </div>
      </section>

      <section style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
          <div
            style={{
              border: "1px solid var(--color-accent)",
              borderRadius: "var(--radius-md)",
              padding: "42px 46px",
            }}
          >
            <h6 style={{ margin: "0 0 10px", color: "var(--color-accent-700)" }}>
              Regra de ouro
            </h6>
            <h2 style={{ margin: "0 0 12px", fontSize: 34, fontWeight: 400 }}>
              O extrato do banco é sempre a fonte da verdade.
            </h2>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.75, maxWidth: "68ch" }}>
              Toda divergência é reportada na mesma direção: o sistema diverge do banco, nunca o
              contrário. Isso encerra a discussão sobre qual número vale e deixa claro o que
              precisa ser corrigido no seu sistema de gestão.
            </p>
          </div>
        </div>
      </section>

      <section
        style={{
          borderTop: "1px solid var(--color-divider)",
          background: "var(--color-neutral-900)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "84px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-accent-300)",
            }}
          >
            Cap. IV · Começar
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 400,
              maxWidth: "26ch",
              color: "var(--ledgr-tinta)",
            }}
          >
            Preço fechado, por volume.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 16.5,
              lineHeight: 1.72,
              maxWidth: "52ch",
              color: "var(--color-neutral-300)",
            }}
          >
            Você paga pelo tanto de lançamento que conferir no mês. Sem fidelidade, sem taxa de
            implantação, sem cobrar por usuário.
          </p>
          <Link
            href="/login"
            className="btn btn-primary"
            style={{
              fontSize: 15.5,
              padding: "13px 24px",
              borderColor: "var(--color-accent-400)",
              color: "var(--color-accent-300)",
            }}
          >
            Subir meus extratos
          </Link>
        </div>
      </section>
    </main>
  );
}

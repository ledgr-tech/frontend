import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

// linhas verticais sutis da landing, só nas laterais e desencontradas: sempre por fora do formulário (424px)
// e, no celular, empurradas para fora da tela para não cruzar os campos
const linhaLateral = {
  position: "absolute" as const,
  top: 0,
  bottom: 0,
  width: 1,
  zIndex: -1,
  pointerEvents: "none" as const,
  background: "var(--color-divider)",
  opacity: 0.55,
};

const linkRodape = {
  color: "inherit",
  textDecoration: "none",
  borderBottom: "1px solid transparent",
  paddingBottom: 1,
};

/** Moldura das telas de acesso (login, cadastro): topo com a marca, conteúdo centralizado e rodapé. */
export function MolduraAuth({
  rotulo,
  children,
  larguraConteudo = 424,
  linhaDireitaNaBorda = false,
}: {
  rotulo: string;
  children: ReactNode;
  /** largura do bloco central (formulário, ou formulário + mascote): as linhas laterais ficam por fora dele */
  larguraConteudo?: number;
  /** leva a linha da direita para perto da borda da tela, deixando a lateral direita livre */
  linhaDireitaNaBorda?: boolean;
}) {
  const folgaLinhas = larguraConteudo / 2 + 48;
  const posicaoLinhaDireita = linhaDireitaNaBorda
    ? `max(calc(50% + ${folgaLinhas}px), calc(100% - 64px))`
    : `max(75%, calc(50% + ${folgaLinhas}px))`;
  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        // cabe na altura da tela: os espaçamentos encolhem com a altura (vh) para não gerar rolagem
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(14px, 3vh, 36px) clamp(20px, 5vw, 56px)",
      }}
    >
      <div aria-hidden="true" style={{ ...linhaLateral, top: "50%", left: `min(25%, calc(50% - ${folgaLinhas}px))` }} />
      <div aria-hidden="true" style={{ ...linhaLateral, bottom: "50%", left: posicaoLinhaDireita }} />

      <header
        style={{
          width: "100%",
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Image
            src="/mascotes/logo-barras.png"
            alt="Ledgr"
            width={1280}
            height={1041}
            sizes="30px"
            loading="eager"
            style={{ height: 24, width: "auto" }}
          />
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>Ledgr</span>
          <span
            className="moldura-rotulo"
            style={{
              paddingLeft: 11,
              borderLeft: "1px solid var(--color-divider)",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
            }}
          >
            {rotulo}
          </span>
        </div>
        <Link href="/" className="login-voltar">
          ← Voltar ao site
        </Link>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 3vh, 40px) 0" }}>
        {children}
      </div>

      <footer
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          textAlign: "center",
          gap: "4px 22px",
          fontSize: 12.5,
          color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
        }}
      >
        {/* páginas de termos e privacidade ainda não existem */}
        <a href="#" className="login-link" style={linkRodape}>
          Termos de uso
        </a>
        <span aria-hidden="true">·</span>
        <a href="#" className="login-link" style={linkRodape}>
          Política de privacidade
        </a>
      </footer>
    </div>
  );
}

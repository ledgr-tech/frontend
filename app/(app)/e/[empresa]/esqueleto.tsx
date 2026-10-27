import type { CSSProperties } from "react";

// Esqueleto de filete, sem shimmer: gradiente animado brigaria com a calma
// editorial do sistema. A forma imita o bloco que vai chegar, para a página não
// pular de lugar quando o conteúdo entra.
//
// ponytail: isso existe porque o mock é localStorage, logo client-only. Com um
// backend de verdade, Server Components + Suspense resolvem sem esqueleto nenhum.

export function Barra({
  largura = "100%",
  altura = 14,
  style,
}: {
  largura?: number | string;
  altura?: number;
  style?: CSSProperties;
}) {
  return <span className="esq-barra" style={{ width: largura, height: altura, ...style }} />;
}

/** Cabeçalho de tela: título, uma linha de apoio e o botão da direita. */
export function EsqueletoCabecalho() {
  return (
    <div className="dash-cabecalho">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Barra largura={220} altura={26} />
        <Barra largura={160} altura={13} />
      </div>
      <Barra largura={124} altura={38} style={{ borderRadius: "var(--radius-md)" }} />
    </div>
  );
}

export function EsqueletoTabela({ linhas = 5, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="esq-tabela">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esq-tabela-linha">
          {Array.from({ length: colunas }, (_, j) => (
            // a primeira coluna é a descrição: mais larga, como na tabela real
            <Barra key={j} largura={j === 1 ? "100%" : 64} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Casca de uma tela do app enquanto o conteúdo carrega. `aria-busy` avisa leitor
 * de tela; o texto escondido dá a mesma notícia para quem não vê a forma.
 */
export function EsqueletoTela({ children }: { children?: React.ReactNode }) {
  return (
    <div aria-busy="true">
      <span className="visualmente-oculto" role="status">
        Carregando…
      </span>
      <EsqueletoCabecalho />
      <div style={{ padding: "32px 0 56px", display: "flex", flexDirection: "column", gap: 36 }}>
        {children ?? <EsqueletoTabela />}
      </div>
    </div>
  );
}

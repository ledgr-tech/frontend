import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A moldura dos Termos de uso e da Política de privacidade: texto corrido na
 * largura de leitura, a data da versão e o aviso de que ela é preliminar.
 *
 * ponytail: o texto das duas páginas descreve o que o código e as decisões
 * técnicas fazem hoje (ADR-002, arquivo bruto não é guardado; ADR-011, IA com
 * mascaramento) e a pesquisa de LGPD do time. Ainda não passou pelo jurídico:
 * quando a versão revisada chegar, saem o aviso de revisão e os `EmDefinicao`.
 */

export const VERSAO = "27 de setembro de 2026";

export function DocumentoLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main>
      <div className="legal-topo">
        <Link href="/" className="legal-marca">
          Ledgr
        </Link>
        <Link href="/login" className="btn btn-secondary">
          Entrar
        </Link>
      </div>
      <article className="legal">
        <h1>{titulo}</h1>
        <p className="legal-data">Versão preliminar de {VERSAO}</p>
        <p role="note" className="aviso-demonstracao">
          <strong>Em revisão jurídica.</strong> Este texto descreve como o Ledgr funciona hoje. Os pontos
          marcados como <em>em definição</em> dependem dessa revisão.
        </p>
        {children}
        <p className="legal-contato">
          Dúvidas e pedidos: <a href="mailto:ledgrtech@gmail.com">ledgrtech@gmail.com</a>
        </p>
      </article>
    </main>
  );
}

/** O que ainda depende da revisão jurídica, dito no próprio lugar em que falta. */
export function EmDefinicao({ children }: { children: ReactNode }) {
  return (
    <p className="legal-pendente">
      <strong>Em definição:</strong> {children}
    </p>
  );
}

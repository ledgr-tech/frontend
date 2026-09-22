"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMPRESA_MOCK } from "@/lib/mock-data";

type ItemMenu = {
  nome: string;
  /** null enquanto a tela não existe: o item aparece, apagado e sem link. */
  href: string | null;
  /** Rotas que deixam este item aceso, além do próprio href. */
  tambem?: string[];
};

// Os cinco destinos do design (navItens em Ledgr.dc.html), na mesma ordem.
const ITENS: ItemMenu[] = [
  { nome: "Extratos", href: null },
  { nome: "Conciliações", href: "/dashboard", tambem: ["/conciliacoes"] },
  { nome: "Fechamentos", href: null },
  { nome: "Histórico", href: "/historico" },
  { nome: "Assinatura", href: null },
];

function estaAtivo(item: ItemMenu, caminho: string): boolean {
  if (item.href === null) return false;
  if (caminho === item.href) return true;
  return (item.tambem ?? []).some((prefixo) => caminho.startsWith(prefixo));
}

export function MenuLateral({ temAvisoNaoLido }: { temAvisoNaoLido: boolean }) {
  const caminho = usePathname();

  return (
    <aside className="app-aside">
      <div className="app-aside-marca">
        <span className="app-avatar-envelope">
          <Image
            src="/mascotes/mascote-avatar.png"
            alt=""
            width={1254}
            height={1254}
            sizes="34px"
            className="app-avatar"
          />
          {temAvisoNaoLido && <span className="app-avatar-ponto" aria-hidden="true" />}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 19,
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            Ledgr
          </span>
          <span className="app-aside-aviso">
            {temAvisoNaoLido ? "3 avisos para você" : "tudo em ordem"}
          </span>
        </span>
      </div>

      <nav className="app-nav" aria-label="Seções do app">
        {ITENS.map((item) =>
          item.href === null ? (
            <span
              key={item.nome}
              className="app-nav-item app-nav-item-indisponivel"
              aria-disabled="true"
              title="Ainda não construída"
            >
              {item.nome}
            </span>
          ) : (
            <Link
              key={item.nome}
              href={item.href}
              className="app-nav-item"
              aria-current={estaAtivo(item, caminho) ? "page" : undefined}
              data-ativo={estaAtivo(item, caminho) ? "true" : undefined}
            >
              {item.nome}
            </Link>
          ),
        )}
      </nav>

      <div className="app-aside-empresa">
        <span className="app-aside-rotulo">Empresa</span>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 600 }}>
          {EMPRESA_MOCK}
        </span>
        <Link href="/" className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 13.5 }}>
          Ver o site
        </Link>
      </div>
    </aside>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const SECOES = [
  { rotulo: "O problema", href: "#problema", capitulo: "Cap. II" },
  { rotulo: "Como funciona", href: "#como", capitulo: "Cap. III" },
  { rotulo: "Assinatura", href: "#preco", capitulo: "Cap. IV" },
];

// mesma largura do globals.css: a partir dela volta a navegação completa, então o menu de opções fecha
const TELA_LARGA = "(min-width: 961px)";

const linkNavegacao = { fontSize: 15, color: "var(--color-text)", textDecoration: "none" } as const;

/** As três barras do logo em SVG: no menu aberto a do meio some e as outras cruzam em X (globals.css). */
function BarrasLedgr() {
  return (
    <svg className="site-menu-barras" viewBox="0 0 2000 1627" aria-hidden="true">
      <g fill="currentColor">
        <rect className="barra-1" x="60" y="43" width="1162" height="463" rx="231.5" />
        <rect className="barra-2" x="76" y="560" width="1896" height="463" rx="231.5" />
        <rect className="barra-3" x="43" y="1060" width="1629" height="463" rx="231.5" />
      </g>
    </svg>
  );
}

/**
 * Cabeçalho da landing. Em telas largas, marca à esquerda e navegação completa; no celular e no tablet,
 * a marca (as barras do logo) vai para a direita e abre um menu de opções.
 */
export function CabecalhoSite() {
  const [aberto, setAberto] = useState(false);
  const cabecalho = useRef<HTMLElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!aberto) return;

    function tecla(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    }
    function toqueFora(evento: PointerEvent) {
      if (!cabecalho.current?.contains(evento.target as Node)) setAberto(false);
    }
    const telaLarga = typeof window.matchMedia === "function" ? window.matchMedia(TELA_LARGA) : null;
    function mudouLargura() {
      if (telaLarga?.matches) setAberto(false);
    }

    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", toqueFora);
    telaLarga?.addEventListener("change", mudouLargura);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", toqueFora);
      telaLarga?.removeEventListener("change", mudouLargura);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <header
      ref={cabecalho}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
        backdropFilter: "blur(6px)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div
        className="site-cabecalho-conteudo"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "20px clamp(20px, 4.2vw, 56px)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Image
            className="site-logo-marca"
            src="/mascotes/logo-barras.png"
            alt="Ledgr"
            width={1280}
            height={1041}
            sizes="32px"
            loading="eager"
            style={{ height: 26, width: "auto" }}
          />
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 23, fontWeight: 600 }}>Ledgr</span>
          <span
            className="site-slogan"
            style={{
              paddingLeft: 12,
              borderLeft: "1px solid var(--color-divider)",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
            }}
          >
            Conciliação bancária
          </span>
        </div>

        <nav
          aria-label="Navegação principal"
          className="site-nav"
          style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 28px" }}
        >
          {SECOES.map((secao) => (
            <a key={secao.href} href={secao.href} style={linkNavegacao}>
              {secao.rotulo}
            </a>
          ))}
          <Link href="/login" className="btn btn-ghost">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn btn-primary">
            Começar
          </Link>
        </nav>

        <button
          ref={botao}
          type="button"
          className="site-menu-botao"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          aria-expanded={aberto}
          aria-controls={menuId}
          onClick={() => setAberto((atual) => !atual)}
        >
          <BarrasLedgr />
        </button>
      </div>

      {aberto && (
        <div id={menuId} className="site-menu">
          <nav aria-label="Menu do site">
            <ul>
              {SECOES.map((secao) => (
                <li key={secao.href}>
                  <a href={secao.href} className="site-menu-link" onClick={fechar}>
                    {secao.rotulo}
                    <span className="site-menu-cap" aria-hidden="true">
                      {secao.capitulo}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="site-menu-acoes">
              <Link href="/login" className="btn btn-secondary" onClick={fechar}>
                Entrar
              </Link>
              <Link href="/cadastro" className="btn btn-primary" onClick={fechar}>
                Começar
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

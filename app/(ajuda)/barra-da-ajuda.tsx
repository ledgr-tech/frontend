"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LogoBarras } from "../(app)/e/[empresa]/logo-barras";
import { paraOndeVoltar } from "./ajuda/voltar";

/** A barra da Central de ajuda: a marca e a única saída, de volta ao Ledgr. */
export function BarraDaAjuda() {
  const router = useRouter();
  return (
    <header className="ajd-barra">
      <Link href="/ajuda" className="ajd-barra-marca">
        <LogoBarras className="app-logo" />
        <span>Ledgr</span>
        <span className="ajd-barra-nome">Central de ajuda</span>
      </Link>
      <Link
        href="/visao-geral"
        className="btn btn-secondary"
        onClick={(evento) => {
          evento.preventDefault();
          router.push(paraOndeVoltar());
        }}
      >
        <ArrowLeft size={16} aria-hidden />
        Voltar ao Ledgr
      </Link>
    </header>
  );
}

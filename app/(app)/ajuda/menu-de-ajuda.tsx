"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, LibraryBig, RotateCcw } from "lucide-react";
import { abrirAjuda, abrirTutorial, mostrarAjudaNaColuna } from "@/lib/eventos";
import { useTemColuna } from "../coluna/coluna";
import { telaDoCaminho } from "../tutorial/roteiros";
import { ajudaDaTela } from "./paginas";

const ICONE = { size: 18, "aria-hidden": true } as const;

/**
 * O botão de ajuda da barra do topo (#171), no desenho do "Avisos" ao lado. Abre um menu com o que
 * a tela aberta tem: a ajuda dela num painel, o tutorial do mascote e, sempre, a Central de ajuda.
 */
export function MenuDeAjuda() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const tela = telaDoCaminho(usePathname());
  const pagina = ajudaDaTela(tela);
  const comColuna = useTemColuna();

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    }
    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function escolher(acao: () => void) {
    setAberto(false);
    acao();
  }

  return (
    <div className="ajd-menu-envelope" ref={caixa}>
      <button
        ref={botao}
        type="button"
        className="app-avisos-botao ajd-botao"
        aria-expanded={aberto}
        aria-controls={aberto ? "menu-de-ajuda" : undefined}
        aria-label="Ajuda"
        onClick={() => setAberto((estava) => !estava)}
      >
        <CircleHelp {...ICONE} />
        <span className="ajd-botao-rotulo">Ajuda</span>
      </button>

      {aberto && (
        <div id="menu-de-ajuda" className="app-painel ajd-menu">
          {(pagina || comColuna) && (
            <button
              type="button"
              className="ajd-menu-item"
              onClick={() => escolher(comColuna ? mostrarAjudaNaColuna : abrirAjuda)}
            >
              <BookOpen {...ICONE} />
              <span className="ajd-menu-titulo">Ajuda desta tela</span>
              <span className="ajd-menu-detalhe">
                Os passos e o que fazer se der errado.
              </span>
            </button>
          )}
          {tela && (
            <button
              type="button"
              className="ajd-menu-item"
              onClick={() => escolher(abrirTutorial)}
            >
              <RotateCcw {...ICONE} />
              <span className="ajd-menu-titulo">Rever o tutorial</span>
              <span className="ajd-menu-detalhe">
                O mascote mostra a tela de novo.
              </span>
            </button>
          )}
          <Link
            href={pagina ? `/ajuda/${pagina.id}` : "/ajuda"}
            className="ajd-menu-item"
            onClick={() => setAberto(false)}
          >
            <LibraryBig {...ICONE} />
            <span className="ajd-menu-titulo">Central de ajuda</span>
            <span className="ajd-menu-detalhe">Todas as telas, com busca.</span>
          </Link>
        </div>
      )}
    </div>
  );
}

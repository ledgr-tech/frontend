"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { ABRIR_AJUDA } from "@/lib/eventos";
import { telaDoCaminho } from "../tutorial/roteiros";
import { Texto } from "./blocos";
import { ajudaDaTela, type PaginaDeAjuda } from "./paginas";

/**
 * A ajuda da tela aberta (#171), num painel à direita que o "Ajuda desta tela" do menu abre. Não é
 * modal, como o assistente: dá para ler e mexer na tela ao mesmo tempo. A `key` da tela fecha o
 * painel ao trocar de tela, como o tutorial.
 */
export function PainelDaRota() {
  const tela = telaDoCaminho(usePathname());
  const pagina = ajudaDaTela(tela);
  return pagina ? <PainelDeAjuda key={tela} pagina={pagina} /> : null;
}

/** O painel some: o foco volta ao botão que abriu o menu. */
function focarBotaoDeAjuda() {
  document.querySelector<HTMLButtonElement>(".ajd-botao")?.focus();
}

function PainelDeAjuda({ pagina }: { pagina: PaginaDeAjuda }) {
  const [aberto, setAberto] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(ABRIR_AJUDA, abrir);
    return () => window.removeEventListener(ABRIR_AJUDA, abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    titulo.current?.focus();
    // dentro de uma janela <dialog>, o Esc é dela
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]"))
        return;
      setAberto(false);
      focarBotaoDeAjuda();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    focarBotaoDeAjuda();
  }

  if (!aberto) return null;
  return (
    <section
      className="ajd-painel"
      role="dialog"
      aria-label={`Ajuda: ${pagina.titulo}`}
    >
      <div className="ajd-painel-topo">
        <Image
          src="/mascotes/mascote-explicando.png"
          alt=""
          width={52}
          height={52}
          className="tutorial-mascote"
        />
        <span className="tutorial-contagem">Ajuda · {pagina.titulo}</span>
        <button
          type="button"
          className="app-icone-botao"
          aria-label="Fechar a ajuda"
          onClick={fechar}
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="ajd-painel-corpo">
        <div>
          <h2 className="tutorial-titulo" ref={titulo} tabIndex={-1}>
            {pagina.titulo}
          </h2>
          <p className="ajd-painel-texto">{pagina.serve}</p>
        </div>
        <ol className="ajd-painel-funcoes">
          {pagina.funcoes.map((funcao) => (
            <li key={funcao.id}>
              <Link
                href={`/ajuda/${pagina.id}#${funcao.id}`}
                onClick={() => setAberto(false)}
              >
                <strong>{funcao.titulo}</strong>
                <span>
                  <Texto>{funcao.faz}</Texto>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div className="ajd-painel-rodape">
        <Link
          href={`/ajuda/${pagina.id}`}
          className="btn btn-primary"
          onClick={() => setAberto(false)}
        >
          Abrir a página completa
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "../../reveal";
import { Texto } from "./blocos";
import { PAGINAS, paginaDeAjuda, type ImagemDaAjuda } from "./paginas";

/**
 * A Central de ajuda (#171), feita para ler: as telas à esquerda, o texto no centro e, à direita,
 * "Nesta página" com as funcionalidades da tela, que acompanha a rolagem. Anterior e próxima no fim.
 */
export function CentralDeAjuda({ id }: { id: string }) {
  const pagina = paginaDeAjuda(id) ?? PAGINAS[0];
  const indice = PAGINAS.indexOf(pagina);
  const anterior = PAGINAS[indice - 1];
  const proxima = PAGINAS[indice + 1];
  const [atual, setAtual] = useState(pagina.funcoes[0]?.id);
  const [ampliada, setAmpliada] = useState<{ imagem: ImagemDaAjuda; alt: string } | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const listaDoIndice = useRef<HTMLOListElement>(null);
  const marca = useRef<HTMLSpanElement>(null);

  // trocar de tela: o foco vai ao título, para leitores de tela, e "Nesta página" volta ao começo
  const [vista, setVista] = useState(pagina.id);
  if (vista !== pagina.id) {
    setVista(pagina.id);
    setAtual(pagina.funcoes[0]?.id);
  }
  // vindo de um link com âncora (o painel "Ajuda desta tela"), o Next rola até a seção; o foco no
  // título é só para quem chega no topo. O endereço com a âncora só muda depois da montagem
  useEffect(() => {
    const quadro = requestAnimationFrame(() => {
      if (!location.hash) titulo.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(quadro);
  }, [pagina.id]);

  // "Nesta página" marca a seção que está no alto da janela
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) setAtual(entrada.target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const funcao of pagina.funcoes) {
      const secao = document.getElementById(funcao.id);
      if (secao) observador.observe(secao);
    }
    return () => observador.disconnect();
  }, [pagina]);

  // o traço dourado de "Nesta página" desliza até a seção atual (a transição é do CSS)
  useEffect(() => {
    const link = listaDoIndice.current?.querySelector<HTMLElement>("[aria-current]");
    if (!link || !marca.current) return;
    marca.current.style.transform = `translateY(${link.offsetTop}px)`;
    marca.current.style.height = `${link.offsetHeight}px`;
  }, [atual, pagina.id]);

  return (
    <div className="ajd-central">
      <nav className="ajd-telas" aria-label="Telas do Ledgr">
        <p className="ajd-rotulo">Central de ajuda</p>
        <ol>
          {PAGINAS.map((item) => (
            <li key={item.id}>
              <Link
                href={`/ajuda/${item.id}`}
                className="ajd-tela"
                aria-current={item.id === pagina.id ? "page" : undefined}
              >
                {item.titulo}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      {/* a key reinicia a entrada do artigo a cada tela; o menu e "Nesta página" ficam parados */}
      <article
        key={pagina.id}
        className="ajd-artigo"
        aria-labelledby="ajd-titulo"
      >
        <p className="ajd-onde">{pagina.onde}</p>
        <h1 id="ajd-titulo" className="ajd-titulo" ref={titulo} tabIndex={-1}>
          {pagina.titulo}
        </h1>
        <p className="ajd-serve">{pagina.serve}</p>

        <div className="ajd-video">
          {pagina.video ? (
            <video
              src={pagina.video}
              poster={pagina.capa.src}
              controls
              preload="metadata"
            />
          ) : (
            <button
              type="button"
              className="ajd-video-capa"
              aria-label={`Ver a tela ${pagina.titulo} maior`}
              onClick={() =>
                setAmpliada({ imagem: pagina.capa, alt: `A tela ${pagina.titulo}` })
              }
            >
              <Image
                src={pagina.capa.src}
                width={pagina.capa.largura}
                height={pagina.capa.altura}
                alt={`A tela ${pagina.titulo} do Ledgr, com dados de exemplo`}
                sizes="(max-width: 820px) 100vw, 680px"
                priority
              />
              <span className="ajd-video-selo">
                <i aria-hidden="true">▶</i>
                Vídeo desta tela em breve
              </span>
            </button>
          )}
          <ol className="ajd-capitulos" aria-label="Capítulos do vídeo">
            {pagina.funcoes.map((funcao, i) => (
              <li key={funcao.id}>
                <span>{i + 1}</span>
                {funcao.titulo}
              </li>
            ))}
          </ol>
        </div>

        {pagina.funcoes.map((funcao) => (
          <Reveal key={funcao.id}>
            <section
              id={funcao.id}
              className="ajd-funcao"
              aria-labelledby={`ajd-${funcao.id}`}
            >
              <h2 id={`ajd-${funcao.id}`}>{funcao.titulo}</h2>
              <p>
                <Texto>{funcao.faz}</Texto>
              </p>
              {funcao.imagem && (
                <button
                  type="button"
                  className="ajd-figura"
                  // a largura sai da proporção, com até 420px de altura: o espaço fica reservado antes
                  // da imagem carregar, e a rolagem até uma âncora não para no meio do caminho
                  style={{
                    width: `min(100%, ${Math.round((420 * funcao.imagem.largura) / funcao.imagem.altura)}px)`,
                  }}
                  aria-label={`Ampliar a imagem de ${funcao.titulo}`}
                  onClick={() =>
                    setAmpliada({ imagem: funcao.imagem!, alt: funcao.titulo })
                  }
                >
                  <Image
                    src={funcao.imagem.src}
                    width={funcao.imagem.largura}
                    height={funcao.imagem.altura}
                    alt={`${funcao.titulo}, na tela ${pagina.titulo}`}
                    sizes="(max-width: 820px) 100vw, 680px"
                  />
                </button>
              )}
              {funcao.passos && (
                <>
                  <p className="ajd-como">Como fazer</p>
                  <ol className="ajd-passos">
                    {funcao.passos.map((passo) => (
                      <li key={passo}>
                        <span>
                          <Texto>{passo}</Texto>
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {funcao.nota && (
                <p className="ajd-nota">
                  <Texto>{funcao.nota}</Texto>
                </p>
              )}
            </section>
          </Reveal>
        ))}

        <nav className="ajd-vizinhas" aria-label="Outras telas">
          {anterior && (
            <Link href={`/ajuda/${anterior.id}`} className="ajd-vizinha">
              <small>← Anterior</small>
              <strong>{anterior.titulo}</strong>
            </Link>
          )}
          {proxima && (
            <Link
              href={`/ajuda/${proxima.id}`}
              className="ajd-vizinha ajd-vizinha-proxima"
            >
              <small>Próxima →</small>
              <strong>{proxima.titulo}</strong>
            </Link>
          )}
        </nav>
      </article>

      <aside className="ajd-indice" aria-label="Nesta página">
        <p className="ajd-rotulo">Nesta página</p>
        <span className="ajd-indice-marca" ref={marca} aria-hidden="true" />
        <ol ref={listaDoIndice}>
          {pagina.funcoes.map((funcao) => (
            <li key={funcao.id}>
              <a
                href={`#${funcao.id}`}
                aria-current={funcao.id === atual ? "location" : undefined}
                onClick={() => setAtual(funcao.id)}
              >
                {funcao.titulo}
              </a>
            </li>
          ))}
        </ol>
      </aside>

      {ampliada && (
        <ImagemAmpliada {...ampliada} onFechar={() => setAmpliada(null)} />
      )}
    </div>
  );
}

/** A imagem grande, numa janela que fecha com Esc, no botão ou clicando fora. */
function ImagemAmpliada({
  imagem,
  alt,
  onFechar,
}: {
  imagem: ImagemDaAjuda;
  alt: string;
  onFechar: () => void;
}) {
  const janela = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = janela.current;
    if (dialogo && !dialogo.open) dialogo.showModal?.();
  }, []);
  return (
    <dialog
      ref={janela}
      className="ajd-ampliada"
      aria-label={alt}
      onClose={onFechar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <button type="button" className="btn btn-secondary" onClick={onFechar}>
        Fechar
      </button>
      <Image
        src={imagem.src}
        width={imagem.largura}
        height={imagem.altura}
        alt={alt}
        sizes="96vw"
      />
    </dialog>
  );
}

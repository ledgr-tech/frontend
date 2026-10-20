"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { abrirAssistente } from "@/lib/eventos";
import { Cabecalho } from "../cabecalho";
import {
  NotaDaAjuda,
  PassosDaAjuda,
  SeDerErrado,
  VideoDaAjuda,
} from "./blocos";
import { PAGINAS, paginaDeAjuda, procurarAjuda } from "./paginas";
import { Planta } from "./planta";

/** A Central de ajuda (#171): o índice com busca à esquerda e a página da tela escolhida. */
export function CentralDeAjuda({ id }: { id: string }) {
  const pagina = paginaDeAjuda(id) ?? PAGINAS[0];
  const [termo, setTermo] = useState("");
  const [realce, setRealce] = useState<number | null>(null);
  const achadas = procurarAjuda(termo);
  const indice = PAGINAS.indexOf(pagina);
  const anterior = PAGINAS[indice - 1];
  const proxima = PAGINAS[indice + 1];

  return (
    <div className="ajd-central">
      <Cabecalho
        titulo="Central de ajuda"
        contexto={[`${PAGINAS.length} telas do fluxo principal`]}
      />

      <div className="ajd-central-corpo">
        <nav className="ajd-indice" aria-label="Páginas da ajuda">
          <label className="ajd-procurar">
            <Search size={16} aria-hidden />
            <input
              type="search"
              className="input"
              placeholder="Procurar na ajuda"
              aria-label="Procurar na ajuda"
              value={termo}
              onChange={(evento) => setTermo(evento.target.value)}
            />
          </label>
          <span className="ajd-indice-grupo">Fluxo principal</span>
          {achadas.map((item) => {
            const Icone = item.icone;
            return (
              <Link
                key={item.id}
                href={`/ajuda/${item.id}`}
                className="ajd-indice-item"
                aria-current={item.id === pagina.id ? "page" : undefined}
              >
                <Icone size={18} aria-hidden />
                {item.titulo}
              </Link>
            );
          })}
          {achadas.length === 0 && (
            <p className="ajd-indice-vazio" role="status">
              Nada encontrado. Tente “CSV”, “tolerância” ou “justificar”.
            </p>
          )}
        </nav>

        <article className="ajd-artigo" aria-labelledby="ajd-artigo-titulo">
          <header className="ajd-artigo-cabeca">
            <span className="tutorial-contagem">
              Fluxo principal · {indice + 1} de {PAGINAS.length}
            </span>
            <h2 id="ajd-artigo-titulo" className="ajd-artigo-titulo">
              {pagina.titulo}
            </h2>
            <p className="ajd-artigo-resumo">{pagina.resumo}</p>
            <span className="ajd-onde">
              <pagina.icone size={14} aria-hidden />
              {pagina.onde}
            </span>
          </header>

          <VideoDaAjuda pagina={pagina} />

          <section className="ajd-bloco" aria-labelledby="ajd-passo-a-passo">
            <h3 id="ajd-passo-a-passo" className="ajd-bloco-titulo">
              Passo a passo
            </h3>
            <div className="card ajd-passo-a-passo">
              <Planta pagina={pagina} marcas realce={realce} />
              <PassosDaAjuda pagina={pagina} emLinha onRealce={setRealce} />
              <NotaDaAjuda pagina={pagina} />
            </div>
          </section>

          <SeDerErrado pagina={pagina} />

          {pagina.perguntas.length > 0 && (
            <section className="ajd-bloco" aria-labelledby="ajd-perguntas">
              <h3 id="ajd-perguntas" className="ajd-bloco-titulo">
                Perguntas comuns
              </h3>
              <div className="ajd-perguntas">
                {pagina.perguntas.map(([pergunta, resposta]) => (
                  <details key={pergunta}>
                    <summary>
                      {pergunta}
                      <ChevronRight size={18} aria-hidden />
                    </summary>
                    <p>{resposta}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            className="ajd-assistente"
            onClick={abrirAssistente}
          >
            <Image
              src="/mascotes/mascote-chatbot.png"
              alt=""
              width={1254}
              height={1254}
              sizes="44px"
            />
            <span>
              <span className="tutorial-contagem">Assistente</span>
              <strong>Ficou alguma dúvida?</strong>
              <span>Pergunte ao Ledgr sobre o seu mês.</span>
            </span>
          </button>

          <nav className="ajd-vizinhas" aria-label="Outras páginas">
            {anterior ? (
              <Link href={`/ajuda/${anterior.id}`} className="ajd-vizinha">
                <span className="tutorial-contagem">Anterior</span>
                <strong>{anterior.titulo}</strong>
              </Link>
            ) : (
              <span />
            )}
            {proxima && (
              <Link
                href={`/ajuda/${proxima.id}`}
                className="ajd-vizinha ajd-vizinha-proxima"
              >
                <span className="tutorial-contagem">Próxima</span>
                <strong>{proxima.titulo}</strong>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </div>
  );
}

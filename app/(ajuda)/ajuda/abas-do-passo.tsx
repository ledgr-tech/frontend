"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { DOCUMENTACAO_DA_IA, ENDERECO_SEM_BASE } from "@/lib/conexao-ia";
import { Texto } from "./blocos";
import type { AbaDoPasso } from "./paginas";

/**
 * O passo a passo com uma aba por IA: setas, Home e End trocam de aba (o padrão de tablist), e cada passo
 * termina dizendo quando deu certo. A aba escolhida é de quem chama, porque o vídeo da página a segue.
 */
export function AbasDoPasso({
  abas,
  endereco,
  aba,
  onAba,
}: {
  abas: AbaDoPasso[];
  endereco: string | null;
  aba: AbaDoPasso["id"];
  onAba: (id: AbaDoPasso["id"]) => void;
}) {
  const base = useId();
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = abas.find((item) => item.id === aba) ?? abas[0];
  const indice = abas.indexOf(atual);

  function teclas(evento: KeyboardEvent) {
    const destino =
      evento.key === "ArrowRight" ? (indice + 1) % abas.length
      : evento.key === "ArrowLeft" ? (indice - 1 + abas.length) % abas.length
      : evento.key === "Home" ? 0
      : evento.key === "End" ? abas.length - 1
      : null;
    if (destino === null) return;
    evento.preventDefault();
    onAba(abas[destino].id);
    botoes.current[destino]?.focus();
  }

  return (
    <div className="ajd-abas">
      <div role="tablist" aria-label="Qual IA" className="ajd-abas-lista" onKeyDown={teclas}>
        {abas.map((item, i) => (
          <button
            key={item.id}
            ref={(botao) => {
              botoes.current[i] = botao;
            }}
            type="button"
            role="tab"
            id={`${base}-${item.id}`}
            aria-controls={`${base}-painel`}
            aria-selected={item === atual}
            tabIndex={item === atual ? 0 : -1}
            onClick={() => onAba(item.id)}
          >
            {item.rotulo}
          </button>
        ))}
      </div>
      <ol role="tabpanel" id={`${base}-painel`} aria-labelledby={`${base}-${atual.id}`} className="ajd-abas-passos">
        {atual.passos.map((passo, i) => (
          <li key={passo.titulo}>
            <span className="ajd-passo-num" aria-hidden="true">{i + 1}</span>
            <div>
              <strong>{passo.titulo}</strong>
              <span>
                <Texto>{passo.texto}</Texto>
              </span>
              {passo.comando && (
                <code className="ajd-codigo">{`claude mcp add --transport http ledgr ${endereco ?? ENDERECO_SEM_BASE}`}</code>
              )}
              <span className="ajd-certo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <span>Deu certo quando {passo.certo}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="ajd-abas-ajuda">
        Se um nome de menu não bater, veja a{" "}
        <a href={DOCUMENTACAO_DA_IA.chatgpt} target="_blank" rel="noopener noreferrer" className="link-animado">
          ajuda do ChatGPT
        </a>{" "}
        ou a{" "}
        <a href={DOCUMENTACAO_DA_IA.claude} target="_blank" rel="noopener noreferrer" className="link-animado">
          ajuda do Claude
        </a>
        .
      </p>
    </div>
  );
}

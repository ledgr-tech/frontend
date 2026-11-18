"use client";

import { useId, useState } from "react";
import { perguntasDisponiveis, type PerguntaSugerida } from "@/lib/perguntas-para-a-ia";

/** A última pergunta copiada e o que aconteceu; como o endereço e o comando do painel, só a última mostra o aviso. */
type Copia = { id: string; mensagem: string };

export function PerguntasSugeridas() {
  const id = useId();
  const [copia, setCopia] = useState<Copia | null>(null);

  async function copiar(pergunta: PerguntaSugerida) {
    setCopia(null);
    try {
      await navigator.clipboard.writeText(pergunta.texto);
      setCopia({ id: pergunta.id, mensagem: "Copiado" });
    } catch {
      setCopia({ id: pergunta.id, mensagem: "Não foi possível copiar. Selecione a pergunta e copie o texto manualmente." });
    }
  }

  return (
    <section className="conexao-parte" aria-labelledby={id}>
      <h4 id={id} className="conexao-parte-titulo">Perguntas que você pode fazer</h4>
      {perguntasDisponiveis().map((grupo) => (
        <section key={grupo.tema} className="conexao-grupo" aria-labelledby={`${id}-${grupo.tema}`}>
          <h5 id={`${id}-${grupo.tema}`} className="conexao-grupo-titulo">{grupo.titulo}</h5>
          <ul className="api-lista" aria-label={grupo.titulo}>
            {grupo.perguntas.map((pergunta) => (
              <li key={pergunta.id} className="api-chave">
                <div className="api-chave-texto">
                  <p className="conexao-texto">{pergunta.texto}</p>
                  <span role="status" className="cfg-linha-descricao">
                    {copia?.id === pergunta.id ? copia.mensagem : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label={`Copiar pergunta: ${pergunta.texto}`}
                  onClick={() => copiar(pergunta)}
                >
                  Copiar
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <a href="/ajuda/conectar-ia#perguntar" className="cfg-link" target="_blank" rel="noopener">
        Veja mais sobre o que perguntar na Central de ajuda
      </a>
    </section>
  );
}

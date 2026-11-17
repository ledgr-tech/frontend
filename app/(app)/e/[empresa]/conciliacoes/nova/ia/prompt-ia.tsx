"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useAvisoDeRolagem } from "../../aviso-de-rolagem";
import { MensagemErro } from "../../../../../../(auth)/_compartilhado/mensagem-erro";

export function PromptIa({ prompt, onCopiado }: { prompt: string; onCopiado?: () => void }) {
  const titulo = useId();
  const erroAoCopiar = useId();
  const [copiado, setCopiado] = useState(false);
  const [falhaAoCopiar, setFalhaAoCopiar] = useState(false);
  const { caixa, conteudo, medir, descer, acima, abaixo } = useAvisoDeRolagem();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      onCopiado?.();
      setFalhaAoCopiar(false);
    } catch {
      setFalhaAoCopiar(true);
    }
  }

  return (
    <section className="ia-prompt" aria-labelledby={titulo}>
      <div className="ia-prompt-topo">
        <h2 id={titulo} className="font-titulo">
          Prompt para a IA
        </h2>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={copiar}
          aria-describedby={falhaAoCopiar ? erroAoCopiar : undefined}
        >
          {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copiado ? <span className="rotulo-troca">Prompt copiado</span> : "Copiar prompt"}
        </button>
      </div>
      {falhaAoCopiar && (
        <MensagemErro id={erroAoCopiar}>Não foi possível copiar. Selecione o texto do prompt e copie à mão.</MensagemErro>
      )}
      {/* sem barra de rolagem, como o painel da comparação: a borda esfuma e o "Mais abaixo" diz que há mais */}
      <div className="ia-prompt-texto">
        <div
          ref={caixa}
          tabIndex={0}
          role="region"
          aria-label="Texto do prompt"
          className="ia-prompt-rolagem"
          onScroll={medir}
          data-acima={acima || undefined}
          data-abaixo={abaixo || undefined}
        >
          <div ref={conteudo}>
            <pre>{prompt}</pre>
          </div>
        </div>
        {/* atalho do ponteiro: o teclado e o leitor de tela já rolam a caixa */}
        <button type="button" className="comp-mais" aria-hidden="true" tabIndex={-1} data-visivel={abaixo || undefined} onClick={descer}>
          Mais abaixo <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

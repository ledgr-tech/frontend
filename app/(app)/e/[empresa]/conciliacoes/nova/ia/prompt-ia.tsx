"use client";

import { useId, useState } from "react";
import { Check, Copy } from "lucide-react";
import { MensagemErro } from "../../../../../../(auth)/_compartilhado/mensagem-erro";

export function PromptIa({ prompt, onCopiado }: { prompt: string; onCopiado?: () => void }) {
  const titulo = useId();
  const erroAoCopiar = useId();
  const [copiado, setCopiado] = useState(false);
  const [falhaAoCopiar, setFalhaAoCopiar] = useState(false);

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
      <pre tabIndex={0} aria-label="Prompt para a IA">
        {prompt}
      </pre>
    </section>
  );
}

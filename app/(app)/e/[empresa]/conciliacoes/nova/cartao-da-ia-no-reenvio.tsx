"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ERRO_SEM_RESPOSTA } from "../envio";
import { carregarPromptIa, type PromptDaIa } from "./ia/acoes";
import { PromptIa } from "./ia/prompt-ia";

/**
 * O cartão "Só tem o PDF do relatório?" do reenvio. A importação via IA de lá (nova/ia) não carrega o
 * contexto do reenvio, então aqui o prompt abre no próprio cartão e o JSON que a IA devolve entra na
 * folha do sistema, como um CSV.
 */
export function CartaoDaIaNoReenvio({ desligado }: { desligado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [prompt, setPrompt] = useState<PromptDaIa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  async function carregar() {
    if (carregando || prompt) return;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await carregarPromptIa();
      if (!vivo.current) return;
      if (resultado.ok) setPrompt(resultado.dados);
      else setErro(resultado.erro);
    } catch {
      if (vivo.current) setErro(ERRO_SEM_RESPOSTA);
    } finally {
      if (vivo.current) setCarregando(false);
    }
  }

  return (
    <section className="nova-ia-card" aria-labelledby="nova-ia-titulo">
      <h3 id="nova-ia-titulo" className="font-titulo">
        Só tem o PDF do relatório?
      </h3>
      <p>Gere o JSON com a IA que você já usa. Você confere as linhas antes de confirmar.</p>
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={aberto}
          disabled={desligado}
          onClick={() => {
            setAberto(!aberto);
            if (!aberto) void carregar();
          }}
        >
          Gerar JSON com IA
        </button>
      </div>
      {aberto && (
        <>
          <p>Copie o prompt, cole na IA que você usa e anexe o PDF do relatório. Envie na folha do sistema o JSON que ela devolver.</p>
          {carregando && <p role="status">Carregando o prompt…</p>}
          {erro && (
            <div>
              <p role="alert">{erro}</p>
              <button type="button" className="btn btn-secondary" onClick={() => void carregar()}>
                Tentar carregar o prompt
              </button>
            </div>
          )}
          {prompt && <PromptIa prompt={prompt.prompt} />}
        </>
      )}
      {/* com o prompt aberto o mascote cobriria a caixa dele */}
      {!aberto && (
        <Image
          className="nova-ia-mascote"
          src="/mascotes/mascote-lupa.png"
          alt=""
          width={977}
          height={1122}
          sizes="170px"
        />
      )}
    </section>
  );
}

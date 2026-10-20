"use client";

import { useEffect, useState } from "react";
import { caminhoDoFio, pontaDoFio, pontasDoFio } from "./fio";

/**
 * O fio em onda do cartão até o que ele explica. Segue os dois quadro a quadro, como o véu, e só
 * mexe no estado quando o desenho muda. Sem alvo, ou com o alvo fora da tela, não desenha nada.
 */
export function FioDoTutorial({
  cartao,
  alvo,
  largas,
}: {
  cartao: HTMLElement | null;
  alvo: HTMLElement | null;
  largas: boolean;
}) {
  const [fio, setFio] = useState<{ d: string; ponta: string } | null>(null);

  useEffect(() => {
    // o alvo na própria coluna fica ao lado do cartão: um fio de volta atravessaria o cartão
    if (!cartao || !alvo || alvo.closest(".coluna-agora")) return;
    // nas telas menores o fio sai do painel que carrega o cartão, não do cartão
    const origem = largas ? cartao : (cartao.closest<HTMLElement>(".coluna-agora") ?? cartao);
    let quadro = 0;
    let ultimo = "";
    const seguir = () => {
      const pontas = pontasDoFio(origem.getBoundingClientRect(), alvo.getBoundingClientRect(), largas);
      const d = pontas ? caminhoDoFio(pontas.de, pontas.para) : "";
      if (d !== ultimo) {
        ultimo = d;
        setFio(pontas ? { d, ponta: pontaDoFio(pontas.de, pontas.para) } : null);
      }
      quadro = requestAnimationFrame(seguir);
    };
    seguir();
    return () => {
      cancelAnimationFrame(quadro);
      setFio(null);
    };
  }, [cartao, alvo, largas]);

  return (
    <svg className="tutorial-fio" aria-hidden="true">
      {fio && (
        <>
          <path d={fio.d} pathLength={1} />
          <path d={fio.ponta} pathLength={1} className="tutorial-fio-ponta" />
        </>
      )}
    </svg>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

function pediuMenosMovimento() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Interpola até o novo valor quando ele muda — e só quando muda.
 *
 * Montar não anima de propósito: o resto do app já anima a chegada das coisas,
 * e o que falta é mostrar a consequência de uma decisão. Um número que sobe do
 * zero toda vez que a tela abre é decoração; um número que sai de 12.604 para
 * 12.640 depois que você aceitou o valor do banco é a resposta ao seu clique.
 */
export function NumeroAnimado({
  valor,
  formatar,
  duracao = 600,
}: {
  valor: number;
  formatar: (valor: number) => string;
  duracao?: number;
}) {
  // null = não está animando, e aí o que vale é o valor recebido. Guardar só o
  // quadro corrente (em vez do valor exibido) faz o caminho sem animação não
  // escrever estado nenhum, e faz o fim da animação cair exatamente no destino
  // em vez de num float com resíduo.
  const [quadroAtual, setQuadroAtual] = useState<number | null>(null);
  const anterior = useRef(valor);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = valor;
    if (de === valor || pediuMenosMovimento()) return;

    let quadro = 0;
    const inicio = performance.now();
    function passo(agora: number) {
      const t = Math.min(1, (agora - inicio) / duracao);
      // ease-out cúbico: chega desacelerando, como o resto das transições daqui
      const suave = 1 - Math.pow(1 - t, 3);
      setQuadroAtual(t < 1 ? de + (valor - de) * suave : null);
      if (t < 1) quadro = requestAnimationFrame(passo);
    }
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);

  return <>{formatar(quadroAtual ?? valor)}</>;
}

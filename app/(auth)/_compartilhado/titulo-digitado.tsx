"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Ref } from "react";

// mesmo ritmo da saudação do login
const PAUSA_ANTES_DE_DIGITAR_MS = 250;
const VELOCIDADE_DIGITACAO_MS = 45;
const PAUSA_LINHA_VOLTAR_MS = 450;
const LINHA_REPOUSO_PX = 68;

/**
 * Título digitado letra por letra; o traço dourado abaixo acompanha o fim do texto (na linha em que a
 * digitação está, se o título quebrar) e depois volta aos 68px. Troque a `key` para digitar de novo.
 */
export function TituloDigitado({
  texto,
  ref,
  style,
  estiloLinha,
}: {
  texto: string;
  ref?: Ref<HTMLHeadingElement>;
  style?: CSSProperties;
  estiloLinha?: CSSProperties;
}) {
  const [semAnimacao, setSemAnimacao] = useState(false);
  const [digitados, setDigitados] = useState(0);
  const [linhaVoltou, setLinhaVoltou] = useState(false);
  const titulo = useRef<HTMLHeadingElement | null>(null);
  const trechoDigitado = useRef<HTMLSpanElement>(null);
  const linha = useRef<HTMLDivElement>(null);

  const digitacaoCompleta = semAnimacao || digitados >= texto.length;
  const digitando = !digitacaoCompleta;
  const textoDigitado = digitacaoCompleta ? texto : texto.slice(0, digitados);
  const textoRestante = texto.slice(textoDigitado.length);

  useEffect(() => {
    // a preferência de movimento só existe no cliente
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSemAnimacao(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  useEffect(() => {
    if (semAnimacao) return;
    let quantos = 0;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const inicio = setTimeout(() => {
      intervalo = setInterval(() => {
        quantos += 1;
        setDigitados(quantos);
        if (quantos >= texto.length) clearInterval(intervalo);
      }, VELOCIDADE_DIGITACAO_MS);
    }, PAUSA_ANTES_DE_DIGITAR_MS);
    return () => {
      clearTimeout(inicio);
      clearInterval(intervalo);
    };
  }, [texto, semAnimacao]);

  useEffect(() => {
    if (!digitacaoCompleta) return;
    const volta = setTimeout(() => setLinhaVoltou(true), semAnimacao ? 0 : PAUSA_LINHA_VOLTAR_MS);
    return () => clearTimeout(volta);
  }, [digitacaoCompleta, semAnimacao]);

  // largura aplicada direto no DOM: vai da borda do título até o fim do trecho já digitado
  useLayoutEffect(() => {
    const elementoLinha = linha.current;
    const elementoTitulo = titulo.current;
    const elementoDigitado = trechoDigitado.current;
    if (!elementoLinha || !elementoTitulo || !elementoDigitado) return;
    let largura = LINHA_REPOUSO_PX;
    if (!linhaVoltou) {
      const retangulos = elementoDigitado.getClientRects();
      const ultimaLinha = retangulos[retangulos.length - 1];
      if (ultimaLinha) {
        largura = Math.max(LINHA_REPOUSO_PX, ultimaLinha.right - elementoTitulo.getBoundingClientRect().left);
      }
    }
    elementoLinha.style.width = `${largura}px`;
  }, [digitados, linhaVoltou]);

  function guardarTitulo(elemento: HTMLHeadingElement | null) {
    titulo.current = elemento;
    if (typeof ref === "function") ref(elemento);
    else if (ref) (ref as { current: HTMLHeadingElement | null }).current = elemento;
  }

  return (
    <>
      <h1 ref={guardarTitulo} tabIndex={-1} aria-label={texto} data-digitando={digitando ? "true" : "false"} style={style}>
        <span ref={trechoDigitado}>{textoDigitado}</span>
        {digitando && <span className="login-cursor" aria-hidden="true" />}
        {/* o resto invisível já ocupa o espaço final, então o título não pula de linha enquanto é digitado */}
        <span aria-hidden="true" style={{ visibility: "hidden" }}>
          {textoRestante}
        </span>
      </h1>
      <div
        ref={linha}
        data-testid="linha-titulo"
        data-estado={linhaVoltou ? "repouso" : digitacaoCompleta ? "cheia" : "digitando"}
        style={{
          height: 1,
          background: "var(--color-accent)",
          transition: linhaVoltou ? "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)" : "width 90ms linear",
          ...estiloLinha,
        }}
      />
    </>
  );
}

"use client";

import { animate, useInView } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Marca um bloco como "visto" quando ele entra na tela, uma vez: `data-cena="nao"` até lá, "sim"
 * depois. As animações das cenas moram no CSS (globals.css, "Landing animada") e esperam esse
 * atributo. Sem JS ele não existe e o bloco aparece parado; o CSS ainda desliga tudo para quem pede
 * menos movimento.
 */
export function Cena({
  children,
  className,
  style,
  as: Tag = "div",
  margem = "0px 0px -25% 0px",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "ul" | "article" | "section";
  /** quanto da tela o bloco precisa entrar para contar como visto */
  margem?: NonNullable<Parameters<typeof useInView>[1]>["margin"];
}) {
  const ref = useRef<HTMLElement>(null);
  const visto = useInView(ref, { once: true, margin: margem });
  const [montado, setMontado] = useState(false);
  // o atributo só entra no cliente: no HTML do servidor o bloco já vem visível
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMontado(true), []);

  return (
    <Tag
      // @ts-expect-error o ref serve a qualquer uma das tags
      ref={ref}
      className={className}
      style={style}
      data-cena={montado ? (visto ? "sim" : "nao") : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Um número que conta do zero até o valor quando aparece na tela, no formato pt-BR. Antes disso, e
 * sem JS, mostra o valor final.
 */
export function Contagem({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const visto = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
  const [mostrado, setMostrado] = useState(valor);

  useEffect(() => {
    if (!visto) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const controle = animate(0, valor, {
      duration: 1.4,
      delay: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (atual) => setMostrado(Math.round(atual)),
    });
    return () => controle.stop();
  }, [visto, valor]);

  return <span ref={ref}>{mostrado.toLocaleString("pt-BR")}</span>;
}

"use client";

import { LazyMotion, MotionConfig, domAnimation, m, useMotionValue, useTransform } from "motion/react";
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// ponytail: domAnimation (animação + gestos, ~15kb) em vez de domMax.
// Trocar só se a landing precisar de drag ou layout animation.
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        {/* sem JS o initial={{opacity:0}} do SSR deixaria a página em branco, e o fio da trilha
            de "Por dentro" ficaria recortado */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}.por-dentro-fio{clip-path:none!important}`}</style>
        </noscript>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * Entrada de um bloco na primeira vez que ele aparece na tela, subindo 16px com fade, como
 * Linear e Stripe. Uma vez só: quem volta rolando para reler encontra o conteúdo parado.
 * Sem escala: em blocos grandes ela deixa o texto borrado enquanto anima.
 * `viewport` muda o ponto em que o bloco conta como visível: a trilha de "Por dentro" revela
 * cada etapa na altura em que a ponta do fio desenha.
 */
export function Reveal({
  children,
  delay = 0,
  style,
  className,
  viewport,
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
  className?: string;
  viewport?: { amount?: number; margin?: string };
}) {
  return (
    <m.div
      data-reveal
      className={className}
      style={style}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -60px 0px", ...viewport }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

const INK_STROKE_MIN_DISTANCE = 16;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useReducedMotion() {
  const [reducedMotion] = useState(prefersReducedMotion);
  return reducedMotion;
}

// teto de traços ao mesmo tempo, caso o animationend não chegue (bloco escondido não anima)
const INK_MAX_DROPS = 12;

export function InkHover({
  children,
  style,
  className,
  tone = "dark",
  clip = true,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  tone?: "dark" | "light";
  clip?: boolean;
}) {
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: clip ? "hidden" : "visible", ...style }}
      onMouseMove={(e) => {
        const bloco = e.currentTarget;
        const r = bloco.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;

        const last = lastPoint.current;
        lastPoint.current = { x, y };
        if (!last || reducedMotion) return;
        const dx = x - last.x;
        const dy = y - last.y;
        const length = Math.hypot(dx, dy);
        if (length < INK_STROKE_MIN_DISTANCE) return;

        // o traço vai direto para o DOM, fora do React: mexer o mouse não re-renderiza o bloco inteiro
        const anteriores = bloco.querySelectorAll(":scope > [data-ink-drop]");
        if (anteriores.length >= INK_MAX_DROPS) anteriores[0].remove();
        const drop = document.createElement("span");
        drop.dataset.inkDrop = "";
        drop.className = tone === "light" ? "ink-drop ink-drop-light" : "ink-drop";
        drop.style.left = `${(x + last.x) / 2}px`;
        drop.style.top = `${(y + last.y) / 2}px`;
        drop.style.width = `${length}px`;
        drop.style.transform = `translate(-50%, -50%) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI}deg)`;
        drop.addEventListener("animationend", () => drop.remove(), { once: true });
        bloco.append(drop);
      }}
      onMouseLeave={() => {
        lastPoint.current = null;
      }}
    >
      {children}
    </div>
  );
}

export function SpotlightHover({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const reducedMotion = useReducedMotion();
  const spotlight = useTransform(
    [mouseX, mouseY],
    ([x, y]) =>
      `radial-gradient(180px circle at ${x}px ${y}px, color-mix(in srgb, var(--color-accent-300) 22%, transparent), transparent 80%)`,
  );

  return (
    <m.div
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style, background: spotlight }}
      onMouseMove={(e) => {
        if (reducedMotion) return;
        const r = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - r.left);
        mouseY.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        mouseX.set(-9999);
        mouseY.set(-9999);
      }}
    >
      {children}
    </m.div>
  );
}

export function PlanCard({
  children,
  style,
  delay,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
  className?: string;
}) {
  return (
    <Reveal delay={delay}>
      <SpotlightHover className={className} style={style}>
        {children}
      </SpotlightHover>
    </Reveal>
  );
}

"use client";

import { LazyMotion, MotionConfig, animate, domAnimation, m, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

// ponytail: domAnimation (animação + gestos, ~15kb) em vez de domMax.
// Trocar só se a landing precisar de drag ou layout animation.
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        {/* sem JS o initial={{opacity:0}} do SSR deixaria a página em branco */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <m.div
      data-reveal
      style={style}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.15, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

const ANIM = { duration: 8, ease: "easeInOut" as const, repeat: Infinity, repeatDelay: 2 };

export function BarraConciliada({ percentual }: { percentual: number }) {
  const mv = useMotionValue(0);
  const width = useTransform(mv, [0, percentual], ["0%", `${percentual}%`]);
  useEffect(() => animate(mv, percentual, ANIM).stop, [mv, percentual]);
  return <m.div style={{ width, background: "var(--color-neutral-300)" }} />;
}

export function NumeroAnimado({ valor, casas = 1 }: { valor: number; casas?: number }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => v.toFixed(casas).replace(".", ",") + "%");
  useEffect(() => animate(mv, valor, ANIM).stop, [mv, valor]);
  return <m.span>{display}</m.span>;
}

export function PlanCard({
  children,
  style,
  delay,
}: {
  children: ReactNode;
  style?: CSSProperties;
  index: number;
  delay?: number;
}) {
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);
  const spotlight = useTransform(
    [mouseX, mouseY],
    ([x, y]) =>
      `radial-gradient(220px circle at ${x}px ${y}px, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 80%)`,
  );

  return (
    <m.div
      data-reveal
      style={{ ...style, background: spotlight }}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.15, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={(e) => {
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

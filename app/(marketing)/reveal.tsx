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

type InkStroke = { id: number; x: number; y: number; length: number; angle: number };

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
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const nextStrokeId = useRef(0);
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: clip ? "hidden" : "visible", ...style }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;

        const last = lastPoint.current;
        lastPoint.current = { x, y };
        if (!last || reducedMotion) return;
        const dx = x - last.x;
        const dy = y - last.y;
        const length = Math.hypot(dx, dy);
        if (length < INK_STROKE_MIN_DISTANCE) return;
        const id = nextStrokeId.current++;
        setStrokes((current) => [
          ...current.slice(-11),
          { id, x: (x + last.x) / 2, y: (y + last.y) / 2, length, angle: (Math.atan2(dy, dx) * 180) / Math.PI },
        ]);
      }}
      onMouseLeave={() => {
        lastPoint.current = null;
      }}
    >
      {children}
      {strokes.map((stroke) => (
        <span
          key={stroke.id}
          data-ink-drop
          className={tone === "light" ? "ink-drop ink-drop-light" : "ink-drop"}
          style={{
            left: stroke.x,
            top: stroke.y,
            width: stroke.length,
            transform: `translate(-50%, -50%) rotate(${stroke.angle}deg)`,
          }}
          onAnimationEnd={() => setStrokes((current) => current.filter((s) => s.id !== stroke.id))}
        />
      ))}
    </div>
  );
}

export function SpotlightHover({ children, style }: { children: ReactNode; style?: CSSProperties }) {
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
}: {
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <m.div
      data-reveal
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.15, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <SpotlightHover style={style}>{children}</SpotlightHover>
    </m.div>
  );
}

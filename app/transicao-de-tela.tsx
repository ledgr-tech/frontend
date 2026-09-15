"use client";

import * as React from "react";
import type { ComponentType, ReactNode } from "react";

type PropsViewTransition = {
  enter?: string;
  exit?: string;
  default?: string;
  children: ReactNode;
};

// o ViewTransition vem na versão canary do React que o App Router usa; no React estável (testes) ele não
// existe, então a tela só aparece, sem animação — o mesmo que acontece em navegadores sem View Transitions
const ViewTransition = (React as unknown as { ViewTransition?: ComponentType<PropsViewTransition> }).ViewTransition;

/** Anima a troca de telas: a que sai some rápido e a que entra sobe com fade (classe `tela` em globals.css). */
export function TransicaoDeTela({ children }: { children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition enter="tela" exit="tela" default="none">
      {children}
    </ViewTransition>
  );
}

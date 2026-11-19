"use client";

import { useEffect } from "react";

/**
 * Manda ao Sentry o erro que um error boundary engoliu (sem isto o SDK do navegador não o vê).
 * Pelo mesmo import tardio do `instrumentation-client.ts`, para o SDK não pesar nas páginas.
 */
export function useAvisarErro(erro: unknown) {
  useEffect(() => {
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(erro));
  }, [erro]);
}

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { ErroInesperado } from "./tela-de-aviso";

/** Erro inesperado no site e nas telas de acesso: ocupa a página inteira. */
export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // o error boundary engole o erro: sem isto o Sentry do navegador não o vê
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="aviso-pagina">
      <ErroInesperado error={error} retry={retry} voltar={{ href: "/", rotulo: "Voltar ao início" }} />
    </main>
  );
}

"use client";

import { ErroInesperado } from "./tela-de-aviso";

/** Erro inesperado no site e nas telas de acesso: ocupa a página inteira. */
export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="aviso-pagina">
      <ErroInesperado error={error} retry={retry} voltar={{ href: "/", rotulo: "Voltar ao início" }} />
    </main>
  );
}

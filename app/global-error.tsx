"use client";

import { useAvisarErro } from "@/lib/avisar-erro";
import "./globals.css";
import { ErroInesperado } from "./tela-de-aviso";

/** Erro no layout raiz: substitui a página inteira, por isso traz o próprio html e os estilos. */
export default function ErroGlobal({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useAvisarErro(error);
  return (
    <html lang="pt-BR">
      <body>
        <main className="aviso-pagina">
          <ErroInesperado error={error} retry={retry} voltar={{ href: "/", rotulo: "Voltar ao início" }} />
        </main>
      </body>
    </html>
  );
}

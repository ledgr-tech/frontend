import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A tela do mascote para quando a tela pedida não pode aparecer: o 404
 * (`app/not-found.tsx`) e o erro inesperado (`app/error.tsx` e
 * `app/(app)/error.tsx`). Mesmo desenho das telas vazias do app (`.vg-inicio`).
 *
 * Sem "use client" de propósito: o 404 é Server Component e as páginas de erro
 * são Client Components, e as duas usam esta.
 */
const MASCOTES = {
  neutro: { src: "/mascotes/mascote-neutro.png", largura: 881, altura: 900 },
  // o que não foi achado, o mascote procura de lupa
  lupa: { src: "/mascotes/mascote-lupa.png", largura: 977, altura: 1122 },
};

export function TelaDeAviso({
  titulo,
  texto,
  mascote = "neutro",
  children,
}: {
  titulo: string;
  texto: ReactNode;
  mascote?: keyof typeof MASCOTES;
  /** As ações: um botão ou link principal e, se fizer sentido, um secundário. */
  children: ReactNode;
}) {
  const { src, largura, altura } = MASCOTES[mascote];
  return (
    <div className="vg-inicio">
      <Image
        src={src}
        alt=""
        width={largura}
        height={altura}
        sizes="150px"
        // é o primeiro e quase o único conteúdo da tela: carregar na hora, sem surgir depois do texto
        loading="eager"
        style={{ width: 150, height: "auto", display: "block" }}
      />
      {/* fora do app a regra de tipografia do shell não alcança: a Newsreader vem daqui */}
      <h1 style={{ margin: 0, fontFamily: "var(--font-titulo)", fontSize: 32, fontWeight: 400, textWrap: "balance" }}>
        {titulo}
      </h1>
      <p className="vg-inicio-texto">{texto}</p>
      <div className="aviso-acoes">{children}</div>
    </div>
  );
}

/**
 * O erro inesperado de uma tela. O `digest` é o código que o Next põe no erro
 * vindo do servidor e que aparece no log dele: é o que o suporte precisa para
 * achar o que aconteceu, sem a tela mostrar a mensagem crua do erro.
 */
export function ErroInesperado({
  error,
  retry,
  voltar,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  voltar: { href: string; rotulo: string };
}) {
  return (
    <TelaDeAviso
      titulo="Algo deu errado nesta tela."
      texto={
        <>
          Tente de novo. Se continuar, escreva para{" "}
          <a href="mailto:ledgrtech@gmail.com">ledgrtech@gmail.com</a>
          {error.digest ? (
            <>
              {" "}
              com o código <code className="aviso-codigo">{error.digest}</code>
            </>
          ) : null}
          .
        </>
      }
    >
      <button type="button" className="btn btn-primary" onClick={() => retry()}>
        Tentar de novo
      </button>
      <Link href={voltar.href} className="btn btn-secondary">
        {voltar.rotulo}
      </Link>
    </TelaDeAviso>
  );
}

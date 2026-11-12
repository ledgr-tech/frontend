import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A tela do mascote para quando a tela pedida não pode aparecer: o 404
 * (`app/not-found.tsx`), o erro inesperado (`app/error.tsx` e
 * `app/(app)/e/[empresa]/error.tsx`) e a falha ao carregar (`FalhaAoCarregar`).
 * Mesmo desenho das telas vazias do app (`.vg-inicio`).
 *
 * Sem "use client" de propósito: o 404 é Server Component e as páginas de erro
 * são Client Components, e as duas usam esta.
 */
const MASCOTES = {
  neutro: { src: "/mascotes/mascote-neutro.png", largura: 881, altura: 900, exibida: 150 },
  // o que não foi achado, o mascote procura de lupa
  lupa: { src: "/mascotes/mascote-lupa.png", largura: 977, altura: 1122, exibida: 150 },
  // sem conexão, o mascote com as tomadas desligadas; é mais largo, por isso maior para pesar igual
  tomadas: { src: "/mascotes/mascote-tomadas.webp", largura: 690, altura: 434, exibida: 230 },
};

export function TelaDeAviso({
  titulo,
  texto,
  mascote = "neutro",
  nivel: Titulo = "h1",
  children,
}: {
  titulo: string;
  texto: ReactNode;
  mascote?: keyof typeof MASCOTES;
  /** `h2` quando a tela já tem o `h1` no cabeçalho. */
  nivel?: "h1" | "h2";
  /** As ações: um botão ou link principal e, se fizer sentido, um secundário. */
  children: ReactNode;
}) {
  const { src, largura, altura, exibida } = MASCOTES[mascote];
  return (
    <div className="vg-inicio">
      <Image
        src={src}
        alt=""
        width={largura}
        height={altura}
        sizes={`${exibida}px`}
        // é o primeiro e quase o único conteúdo da tela: carregar na hora, sem surgir depois do texto
        loading="eager"
        style={{ width: exibida, height: "auto", display: "block" }}
      />
      {/* fora do app a regra de tipografia do shell não alcança: a Newsreader vem daqui */}
      <Titulo style={{ margin: 0, fontFamily: "var(--font-titulo)", fontSize: 32, fontWeight: 400, textWrap: "balance" }}>
        {titulo}
      </Titulo>
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

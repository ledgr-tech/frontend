import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Moldura das telas de acesso (login, cadastro): topo com a marca, conteúdo centralizado e rodapé. */
export function MolduraAuth({
  rotulo,
  children,
  larguraConteudo = 424,
  linhaDireitaNaBorda = false,
  depois,
}: {
  rotulo: string;
  children: ReactNode;
  /** largura do bloco central (formulário, ou formulário + mascote): as linhas laterais ficam por fora dele */
  larguraConteudo?: number;
  /** leva a linha da direita para perto da borda da tela, deixando a lateral direita livre */
  linhaDireitaNaBorda?: boolean;
  /** o que vem depois do rodapé, fora do <main>: a janela de recuperar a senha do login */
  depois?: ReactNode;
}) {
  const folgaLinhas = larguraConteudo / 2 + 48;
  const posicaoLinhaDireita = linhaDireitaNaBorda
    ? `max(calc(50% + ${folgaLinhas}px), calc(100% - 64px))`
    : `max(75%, calc(50% + ${folgaLinhas}px))`;
  return (
    <div className="auth-moldura">
      {/* linhas verticais sutis da landing, só nas laterais e desencontradas: sempre por fora do bloco
          central e, no celular, empurradas para fora da tela para não cruzar os campos */}
      <div aria-hidden="true" className="auth-linha" style={{ top: "50%", left: `min(25%, calc(50% - ${folgaLinhas}px))` }} />
      <div aria-hidden="true" className="auth-linha" style={{ bottom: "50%", left: posicaoLinhaDireita }} />

      <header className="auth-topo">
        <div className="auth-marca">
          <Image
            src="/mascotes/logo-barras.png"
            alt="Ledgr"
            width={1237}
            height={998}
            sizes="30px"
            loading="eager"
            className="auth-marca-logo"
          />
          <span className="auth-marca-nome">Ledgr</span>
          <span className="moldura-rotulo">{rotulo}</span>
        </div>
        <Link href="/" className="login-voltar">
          ← Voltar ao site
        </Link>
      </header>

      {/* o <main> da página: sem ele, leitor de tela não tem como pular direto para o formulário */}
      <main className="auth-principal">{children}</main>

      <footer className="auth-rodape">
        {/* em outra aba: o que já foi digitado no formulário não se perde */}
        <a href="/termos" target="_blank" rel="noopener" className="login-link">
          Termos de uso
        </a>
        <span aria-hidden="true">·</span>
        <a href="/privacidade" target="_blank" rel="noopener" className="login-link">
          Política de privacidade
        </a>
      </footer>
      {depois}
    </div>
  );
}

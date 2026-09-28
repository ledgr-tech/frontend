"use client";

import { useEffect, useRef } from "react";

export type FaseCriacao = "criando" | "abrindo" | "login";

// cada fase é um fato: o servidor está criando, ou já criou e a pessoa está indo para
// algum lugar. Nada de etapa inventada para encher a espera.
const TEXTOS: Record<FaseCriacao, { titulo: string; texto: (empresa: string) => string }> = {
  criando: {
    titulo: "Criando sua conta…",
    texto: (empresa) => `Cadastrando a empresa ${empresa} e o seu acesso.`,
  },
  abrindo: {
    titulo: "Conta criada.",
    texto: () => "Abrindo sua primeira conciliação…",
  },
  login: {
    titulo: "Conta criada.",
    texto: () => "Agora é só entrar com o seu e-mail e a senha.",
  },
};

/**
 * O que fica no lugar do formulário entre o "Concluir" e a próxima tela. O
 * formulário some com o foco dentro, então o título do painel recebe o foco; a
 * troca de fase é anunciada pelo role="status".
 */
export function CriandoConta({ fase, empresa }: { fase: FaseCriacao; empresa: string }) {
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const { titulo: textoTitulo, texto } = TEXTOS[fase];

  return (
    <div className="cadastro-criando" role="status">
      <span className="eyebrow cadastro-criando-eyebrow">Quase lá</span>
      <h1 ref={titulo} tabIndex={-1} className="cadastro-criando-titulo">
        {textoTitulo}
      </h1>
      <p className="cadastro-criando-texto">{texto(empresa)}</p>
      <div className="cadastro-criando-barra" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { useEffect, useId, useRef, type CSSProperties } from "react";

/**
 * "Esqueci a senha" enquanto o backend não envia e-mail: o cartão diz isso e
 * leva ao suporte, em vez de fingir que mandou um código que nunca chega.
 *
 * ponytail: a recuperação por e-mail é a issue #72 do backend (depende do
 * provedor de e-mail). Quando ela existir, este cartão volta a ter o campo do
 * e-mail e o envio, e ganha a tela de criar a nova senha a partir do código.
 */

const SUPORTE = "ledgrtech@gmail.com";
const ASSUNTO = "Recuperar acesso ao Ledgr";

// mesma curva das animações da landing (Reveal, detalhe do comparativo)
const CURVA = [0.22, 1, 0.36, 1] as const;

// rótulo com a cara de h6, mas em <p>: o título do card é o h2 logo abaixo
const estiloEyebrow: CSSProperties = {
  margin: "0 0 8px",
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: 14,
  lineHeight: 1.12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-accent-700)",
};
const estiloTitulo = {
  margin: "0 0 10px",
  fontFamily: "var(--font-heading)",
  fontSize: 22,
  fontWeight: 600,
  lineHeight: 1.2,
};

export function RecuperarSenha({
  aberto,
  emailInicial,
  onFechar,
}: {
  aberto: boolean;
  emailInicial: string;
  onFechar: () => void;
}) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <AnimatePresence>{aberto && <Cartao emailInicial={emailInicial} onFechar={onFechar} />}</AnimatePresence>
      </MotionConfig>
    </LazyMotion>
  );
}

function Cartao({ emailInicial, onFechar }: { emailInicial: string; onFechar: () => void }) {
  const tituloId = useId();
  const textoId = useId();
  const escrever = useRef<HTMLAnchorElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const email = emailInicial.trim();

  useEffect(() => {
    escrever.current?.focus();
  }, []);

  // Esc fecha e o Tab fica preso dentro do card enquanto ele está aberto
  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.preventDefault();
        onFechar();
        return;
      }
      const elemento = cartao.current;
      if (evento.key !== "Tab" || !elemento) return;
      const focaveis = [...elemento.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]")];
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (evento.shiftKey && (ativo === primeiro || !elemento.contains(ativo))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (ativo === ultimo || !elemento.contains(ativo))) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <m.div
      data-testid="recuperar-fundo"
      className="dialog-backdrop recuperar-fundo"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: CURVA }}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
    >
      <m.div
        ref={cartao}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={textoId}
        className="recuperar-card"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.24, ease: CURVA }}
      >
        <p style={estiloEyebrow}>Recuperar acesso</p>
        <h2 id={tituloId} style={estiloTitulo}>
          Esqueceu a senha?
        </h2>
        <p id={textoId} className="dialog-body" style={{ margin: "0 0 18px", lineHeight: 1.6 }}>
          A recuperação por e-mail ainda não está no ar. Escreva para <strong>{SUPORTE}</strong>{" "}
          {email ? (
            <>
              a partir de <strong>{email}</strong>
            </>
          ) : (
            "a partir do e-mail da sua conta"
          )}
          , e a gente ajuda você a voltar a entrar.
        </p>

        {/* o assunto vai no link; o e-mail da pessoa, não: ela escreve do próprio endereço */}
        <a
          ref={escrever}
          href={`mailto:${SUPORTE}?subject=${encodeURIComponent(ASSUNTO)}`}
          className="btn btn-primary btn-block"
          style={{ fontSize: 15.5, padding: "12px 22px", marginTop: 0, textDecoration: "none", justifyContent: "center" }}
        >
          Escrever para o suporte
        </a>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <button type="button" className="login-link-animado" style={{ fontSize: 14.5 }} onClick={onFechar}>
            Voltar ao login
          </button>
        </div>
      </m.div>
    </m.div>
  );
}

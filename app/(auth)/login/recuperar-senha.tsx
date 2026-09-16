"use client";

import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { CampoTexto } from "../_compartilhado/campo-texto";
import { EMAIL_VALIDO, MENSAGEM_EMAIL_INCOMPLETO } from "../_compartilhado/validacao";

// sem backend ainda: o envio é simulado; o traço dourado carrega durante esse tempo
const ENVIO_SIMULADO_MS = 1200;

// mesma curva das animações da landing (Reveal, detalhe do comparativo)
const CURVA = [0.22, 1, 0.36, 1] as const;

type Etapa = "formulario" | "enviando" | "enviado";

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
  const campoId = useId();
  const [email, setEmail] = useState(emailInicial);
  const [erro, setErro] = useState("");
  // cada erro novo alterna data-tremor entre "a" e "b" para o CSS repetir o tremor do campo
  const [tremor, setTremor] = useState(0);
  const [etapa, setEtapa] = useState<Etapa>("formulario");
  const campo = useRef<HTMLInputElement>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    campo.current?.focus();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
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

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (etapa !== "formulario") return;
    const emailLimpo = email.trim();
    const mensagem = !emailLimpo
      ? "Informe o e-mail da sua conta."
      : !EMAIL_VALIDO.test(emailLimpo)
        ? MENSAGEM_EMAIL_INCOMPLETO
        : "";
    if (mensagem) {
      setErro(mensagem);
      setTremor((atual) => atual + 1);
      campo.current?.focus();
      return;
    }
    setErro("");
    setEtapa("enviando");
    timer.current = setTimeout(() => setEtapa("enviado"), ENVIO_SIMULADO_MS);
  }

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
        {etapa === "enviando" && (
          <m.div
            aria-hidden="true"
            className="recuperar-carregando"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: ENVIO_SIMULADO_MS / 1000, ease: "linear" }}
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
          {etapa !== "enviado" ? (
            <m.form
              key="formulario"
              onSubmit={enviar}
              noValidate
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: CURVA }}
            >
              <p style={estiloEyebrow}>Recuperar acesso</p>
              <h2 id={tituloId} style={estiloTitulo}>
                Esqueceu a senha?
              </h2>
              <p id={textoId} className="dialog-body" style={{ margin: "0 0 18px", lineHeight: 1.6 }}>
                Informe o e-mail da sua conta e enviaremos um código para você criar uma nova senha.
              </p>

              <CampoTexto
                ref={campo}
                id={campoId}
                rotulo="E-mail da conta"
                tipo="email"
                autoComplete="email"
                erro={erro}
                tremor={erro ? (tremor % 2 === 1 ? "a" : "b") : undefined}
                disabled={etapa === "enviando"}
                valor={email}
                onValor={(valor) => {
                  setEmail(valor);
                  if (erro) setErro("");
                }}
              />

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={etapa === "enviando"}
                style={{ fontSize: 15.5, padding: "12px 22px", marginTop: 16 }}
              >
                {etapa === "enviando" ? "Enviando…" : "Enviar código"}
              </button>

              <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                <button type="button" className="login-link-animado" style={{ fontSize: 14.5 }} onClick={onFechar}>
                  Voltar ao login
                </button>
              </div>
            </m.form>
          ) : (
            <Confirmacao key="enviado" email={email.trim()} tituloId={tituloId} textoId={textoId} onFechar={onFechar} />
          )}
        </AnimatePresence>
      </m.div>
    </m.div>
  );
}

function Confirmacao({
  email,
  tituloId,
  textoId,
  onFechar,
}: {
  email: string;
  tituloId: string;
  textoId: string;
  onFechar: () => void;
}) {
  const voltar = useRef<HTMLButtonElement>(null);

  // o botão que tinha o foco (Enviar) sumiu: o foco vai para a próxima ação
  useEffect(() => {
    voltar.current?.focus();
  }, []);

  return (
    <m.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: CURVA }}
    >
      <p style={estiloEyebrow}>Código enviado</p>
      <h2 id={tituloId} style={estiloTitulo}>
        Confira seu e-mail.
      </h2>
      <p id={textoId} className="dialog-body" style={{ margin: "0 0 18px", lineHeight: 1.6 }}>
        Se houver uma conta com <strong>{email}</strong>, o código chega em alguns minutos. Se não aparecer, confira a
        caixa de spam.
      </p>
      <button ref={voltar} type="button" className="btn btn-primary btn-block" style={{ fontSize: 15.5, padding: "12px 22px", marginTop: 0 }} onClick={onFechar}>
        Voltar ao login
      </button>
    </m.div>
  );
}

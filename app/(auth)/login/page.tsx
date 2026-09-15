"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { CHAVE_SAUDACAO, SAUDACOES, escolherSaudacao } from "./saudacoes";

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// mesma pausa do Claude Design: dá tempo de ler "Entrando…" antes de trocar de tela
const ATRASO_ENTRADA_MS = 700;

// a saudação fica sempre em uma linha: a fonte encolhe dentro desse intervalo até caber
const TITULO_MAX_PX = 44;
const TITULO_MIN_PX = 22;

const linkSublinhado = {
  fontSize: 14.5,
  color: "var(--color-accent-700)",
  textDecoration: "none",
  borderBottom: "1px solid var(--color-divider)",
  paddingBottom: 1,
};

// linhas verticais sutis da landing, só nas laterais: sempre por fora do formulário (424px)
// e, no celular, empurradas para fora da tela para não cruzar os campos
const linhaLateral = {
  position: "absolute" as const,
  top: 0,
  bottom: 0,
  width: 1,
  zIndex: -1,
  pointerEvents: "none" as const,
  background: "var(--color-divider)",
  opacity: 0.55,
};

function lerSaudacaoAnterior(): number | null {
  try {
    const salva = window.localStorage.getItem(CHAVE_SAUDACAO);
    return salva === null ? null : Number(salva);
  } catch {
    return null;
  }
}

// olho no traço do mascote: sobrancelha em arco e pupila preta em gota com o recorte de brilho;
// fechado vira a pálpebra curva com cílios
function OlhoMascote({ fechado }: { fechado: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7.2 5.2c2.7-1.9 6.9-1.9 9.6 0" />
      {fechado ? (
        <>
          <path d="M7 13c2.9 3.4 7.1 3.4 10 0" />
          <path d="M9.1 15.7l-.8 1.7M12 16.6v1.9M14.9 15.7l.8 1.7" />
        </>
      ) : (
        <>
          <ellipse cx="12" cy="13.6" rx="4.4" ry="5.8" fill="currentColor" stroke="none" transform="rotate(-6 12 13.6)" />
          {/* brilho em cunha aberto na borda da pupila, como nos olhos do mascote */}
          <path d="M6.6 11.2l5.9 2.8-5.7 2.9z" fill="var(--color-bg)" stroke="none" />
          <path d="M15.3 19c.9.3 1.8.2 2.6-.3" />
        </>
      )}
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [manterSessao, setManterSessao] = useState(true);
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [saudacao, setSaudacao] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  // o StrictMode roda o efeito duas vezes em dev — sem isso o segundo sorteio podia repetir a visita anterior
  const saudacaoSorteada = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (saudacaoSorteada.current) return;
    saudacaoSorteada.current = true;
    const indice = escolherSaudacao(lerSaudacaoAnterior());
    try {
      window.localStorage.setItem(CHAVE_SAUDACAO, String(indice));
    } catch {
      // sem localStorage (aba privada): só não evita repetição
    }
    // o sorteio depende do localStorage, que só existe no cliente
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaudacao(SAUDACOES[indice]);
  }, []);

  useLayoutEffect(() => {
    const elemento = titulo.current;
    if (!elemento) return;

    function ajustarTitulo() {
      if (!elemento) return;
      let tamanho = TITULO_MAX_PX;
      elemento.style.fontSize = `${tamanho}px`;
      while (elemento.scrollWidth > elemento.clientWidth && tamanho > TITULO_MIN_PX) {
        tamanho -= 1;
        elemento.style.fontSize = `${tamanho}px`;
      }
    }

    ajustarTitulo();
    // a fonte do título chega depois do primeiro paint e muda a largura do texto
    document.fonts?.ready.then(ajustarTitulo);
    window.addEventListener("resize", ajustarTitulo);
    return () => window.removeEventListener("resize", ajustarTitulo);
  }, [saudacao]);

  function entrar() {
    if (entrando) return;
    const emailLimpo = email.trim();
    if (!EMAIL_VALIDO.test(emailLimpo)) {
      setErro("Confira o e-mail: parece incompleto.");
      return;
    }
    setErro("");
    setEntrando(true);
    timer.current = setTimeout(() => {
      login(emailLimpo);
      router.push("/dashboard");
    }, ATRASO_ENTRADA_MS);
  }

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    entrar();
  }

  return (
    <div
      style={{
        position: "relative",
        isolation: "isolate",
        overflow: "hidden",
        // cabe na altura da tela: os espaçamentos abaixo encolhem com a altura (vh) para não gerar rolagem
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(14px, 3vh, 36px) clamp(20px, 5vw, 56px)",
      }}
    >
      {/* deslocadas: a da esquerda sobe da base até o meio, a da direita desce do topo até o meio */}
      <div aria-hidden="true" style={{ ...linhaLateral, top: "50%", left: "min(25%, calc(50% - 260px))" }} />
      <div aria-hidden="true" style={{ ...linhaLateral, bottom: "50%", left: "max(75%, calc(50% + 260px))" }} />

      <header
        style={{
          width: "100%",
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Image
            src="/mascotes/logo-barras.png"
            alt="Ledgr"
            width={1280}
            height={1041}
            sizes="30px"
            loading="eager"
            style={{ height: 24, width: "auto" }}
          />
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>Ledgr</span>
          <span
            style={{
              paddingLeft: 11,
              borderLeft: "1px solid var(--color-divider)",
              fontSize: 12,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
            }}
          >
            Acesso
          </span>
        </div>
        <Link href="/" className="login-voltar">
          ← Voltar ao site
        </Link>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 3vh, 40px) 0" }}>
        <form onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "clamp(10px, 2vh, 20px)" }}>
            <span className="eyebrow" style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
              Entrar na conta
            </span>
            <span style={{ flex: 1, maxWidth: 110, height: 1, background: "var(--color-divider)" }} />
          </div>
          <h1
            ref={titulo}
            style={{
              margin: "0 0 clamp(8px, 1.5vh, 14px)",
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.016em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              // só aparece depois do sorteio, para não piscar a saudação padrão do HTML estático
              opacity: saudacao ? 1 : 0,
              transition: "opacity 0.45s ease",
            }}
          >
            {saudacao ?? SAUDACOES[0]}
          </h1>
          <div style={{ width: 68, height: 1, background: "var(--color-accent)", marginBottom: "clamp(16px, 3vh, 32px)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(10px, 1.8vh, 16px)", marginBottom: 8 }}>
            {/* o nome do campo fica no placeholder; o label segue só para leitor de tela */}
            <div className="field">
              <label htmlFor="login-email" className="sr-only">E-mail</label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="E-mail"
                aria-invalid={erro ? true : undefined}
                aria-describedby={erro ? "login-erro" : undefined}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{ minHeight: 50, fontSize: 16, padding: "12px 18px" }}
              />
            </div>
            <div className="field">
              <label htmlFor="login-senha" className="sr-only">Senha</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  id="login-senha"
                  className="input"
                  type={verSenha ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Senha"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  style={{ minHeight: 50, fontSize: 16, padding: "12px 54px 12px 18px" }}
                />
                <button
                  type="button"
                  className="login-ver-senha"
                  aria-controls="login-senha"
                  aria-pressed={verSenha}
                  aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  title={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setVerSenha((atual) => !atual)}
                >
                  <OlhoMascote fechado={verSenha} />
                </button>
              </div>
            </div>
          </div>

          {erro && (
            <div
              id="login-erro"
              role="alert"
              style={{
                marginTop: 12,
                padding: "9px 13px",
                border: "1px solid var(--color-accent)",
                borderLeftWidth: 3,
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--color-accent-700)",
              }}
            >
              {erro}
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px 20px",
              margin: "clamp(12px, 2vh, 18px) 0 clamp(14px, 2.6vh, 26px)",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14.5, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={manterSessao}
                onChange={(event) => setManterSessao(event.target.checked)}
                style={{ width: 15, height: 15, accentColor: "var(--color-accent)", cursor: "pointer" }}
              />
              Manter sessão ativa
            </label>
            {/* recuperação de senha fica para a autenticação real (#5) */}
            <a href="#" className="login-link" style={linkSublinhado}>
              Esqueci a senha
            </a>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={entrando}
            style={{ fontSize: 15.5, padding: "clamp(10px, 1.6vh, 13px) 22px", marginTop: 0 }}
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "clamp(14px, 2.6vh, 26px) 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
            <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 46%, transparent)" }}>
              ou
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
          </div>

          {/* ainda sem provedor: segue o mesmo fluxo mock do botão Entrar */}
          <button type="button" className="btn btn-secondary" disabled={entrando} onClick={entrar} style={{ width: "100%" }}>
            Entrar com Google
          </button>

          <p style={{ margin: "clamp(14px, 2.8vh, 28px) 0 0", fontSize: 14.5, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            Ainda não tem conta?{" "}
            <a href="#" className="login-link" style={{ ...linkSublinhado, borderBottomColor: "var(--color-accent)" }}>
              Criar acesso em três passos
            </a>
          </p>
        </form>
      </div>

      <footer
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          textAlign: "center",
          gap: "4px 22px",
          fontSize: 12.5,
          color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
        }}
      >
        {/* páginas de termos e privacidade ainda não existem */}
        <a href="#" className="login-link" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid transparent", paddingBottom: 1 }}>
          Termos de uso
        </a>
        <span aria-hidden="true">·</span>
        <a href="#" className="login-link" style={{ color: "inherit", textDecoration: "none", borderBottom: "1px solid transparent", paddingBottom: 1 }}>
          Política de privacidade
        </a>
      </footer>
    </div>
  );
}

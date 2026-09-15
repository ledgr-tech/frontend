"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CONTA_TESTE, autenticar, login, type ErroAutenticacao } from "@/lib/auth";
import dynamic from "next/dynamic";
import { MensagemErro } from "./mensagem-erro";
import { CHAVE_SAUDACAO, SAUDACOES, escolherSaudacao } from "./saudacoes";

// o card de recuperação (e o motion que ele usa) fica fora do carregamento inicial do login:
// só é baixado quando alguém se aproxima de "Esqueci a senha"
const RecuperarSenha = dynamic(() => import("./recuperar-senha").then((modulo) => modulo.RecuperarSenha), {
  ssr: false,
});

function precarregarRecuperarSenha() {
  void import("./recuperar-senha");
}

const EMAIL_VALIDO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// mesma pausa do Claude Design: dá tempo de ler "Entrando…" antes de trocar de tela
const ATRASO_ENTRADA_MS = 700;

// a saudação fica sempre em uma linha: a fonte encolhe dentro desse intervalo até caber
const TITULO_MAX_PX = 44;
const TITULO_MIN_PX = 22;

// digitação da saudação: o traço dourado acompanha a frase e depois volta ao tamanho de repouso
const PAUSA_ANTES_DE_DIGITAR_MS = 250;
const VELOCIDADE_DIGITACAO_MS = 45;
const PAUSA_LINHA_VOLTAR_MS = 450;
const LINHA_REPOUSO_PX = 68;

type Campo = "email" | "senha";
type Erros = Partial<Record<Campo, string>>;

// erros checados antes de enviar
const MENSAGENS = {
  emailVazio: "Informe seu e-mail para entrar.",
  emailIncompleto: "Confira o e-mail: parece incompleto.",
  senhaVazia: "Digite sua senha.",
};

// erros devolvidos pela autenticação, cada um mostrado junto ao campo a que se refere
const ERROS_AUTENTICACAO: Record<ErroAutenticacao, { campo: Campo; mensagem: string }> = {
  conta_nao_encontrada: { campo: "email", mensagem: "Não encontramos uma conta com esse e-mail." },
  senha_incorreta: { campo: "senha", mensagem: "Senha incorreta. Confira e tente de novo." },
  muitas_tentativas: { campo: "senha", mensagem: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
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
// os dois estados ficam sempre no SVG: o CSS (.olho-mascote em globals.css) anima a troca como uma piscada
function OlhoMascote({ fechado }: { fechado: boolean }) {
  return (
    <svg
      className="olho-mascote"
      data-estado={fechado ? "fechado" : "aberto"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* riscos de impacto de desenho animado: só piscam no instante em que o olho salta */}
      <path className="olho-impacto" d="M3.6 8.6l-2-1.2M3.2 12.8H.9M3.6 17l-2 1.2M20.4 8.6l2-1.2M20.8 12.8h2.3M20.4 17l2 1.2" />
      <path className="olho-sobrancelha" d="M7.2 5.2c2.7-1.9 6.9-1.9 9.6 0" />
      <g className="olho-aberto">
        <ellipse cx="12" cy="13.6" rx="4.4" ry="5.8" fill="currentColor" stroke="none" transform="rotate(-6 12 13.6)" />
        {/* brilho em cunha aberto na borda da pupila, como nos olhos do mascote */}
        <path d="M6.6 11.2l5.9 2.8-5.7 2.9z" fill="var(--color-bg)" stroke="none" />
        <path d="M15.3 19c.9.3 1.8.2 2.6-.3" />
      </g>
      <g className="olho-fechado">
        <path d="M7 13c2.9 3.4 7.1 3.4 10 0" />
        <path d="M9.1 15.7l-.8 1.7M12 16.6v1.9M14.9 15.7l.8 1.7" />
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [manterSessao, setManterSessao] = useState(true);
  const [erros, setErros] = useState<Erros>({});
  // contador por campo: cada erro novo alterna data-tremor entre "a" e "b" para o CSS repetir o tremor
  const [tremor, setTremor] = useState<Record<Campo, number>>({ email: 0, senha: 0 });
  const [entrando, setEntrando] = useState(false);
  const [recuperarAberto, setRecuperarAberto] = useState(false);
  // depois de aberto uma vez o card continua montado, para a animação de saída rodar ao fechar
  const [recuperarCarregado, setRecuperarCarregado] = useState(false);
  const gatilhoRecuperar = useRef<HTMLButtonElement>(null);
  const campoEmail = useRef<HTMLInputElement>(null);
  const campoSenha = useRef<HTMLInputElement>(null);
  const [saudacao, setSaudacao] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  // o StrictMode roda o efeito duas vezes em dev — sem isso o segundo sorteio podia repetir a visita anterior
  const saudacaoSorteada = useRef(false);
  const [semAnimacao, setSemAnimacao] = useState(false);
  const [digitados, setDigitados] = useState(0);
  const [linhaVoltou, setLinhaVoltou] = useState(false);
  const trechoDigitado = useRef<HTMLSpanElement>(null);
  const linha = useRef<HTMLDivElement>(null);

  const textoCompleto = saudacao ?? SAUDACOES[0];
  const digitacaoCompleta = saudacao !== null && (semAnimacao || digitados >= saudacao.length);
  const digitando = saudacao !== null && !digitacaoCompleta;
  const textoDigitado = saudacao === null ? "" : digitacaoCompleta ? saudacao : saudacao.slice(0, digitados);
  const textoRestante = textoCompleto.slice(textoDigitado.length);

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
    // o sorteio (localStorage) e a preferência de movimento só existem no cliente
    /* eslint-disable react-hooks/set-state-in-effect */
    setSemAnimacao(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    setSaudacao(SAUDACOES[indice]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!saudacao || semAnimacao) return;
    let quantos = 0;
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const inicio = setTimeout(() => {
      intervalo = setInterval(() => {
        quantos += 1;
        setDigitados(quantos);
        if (quantos >= saudacao.length) clearInterval(intervalo);
      }, VELOCIDADE_DIGITACAO_MS);
    }, PAUSA_ANTES_DE_DIGITAR_MS);
    return () => {
      clearTimeout(inicio);
      clearInterval(intervalo);
    };
  }, [saudacao, semAnimacao]);

  useEffect(() => {
    if (!digitacaoCompleta) return;
    const volta = setTimeout(() => setLinhaVoltou(true), semAnimacao ? 0 : PAUSA_LINHA_VOLTAR_MS);
    return () => clearTimeout(volta);
  }, [digitacaoCompleta, semAnimacao]);

  // largura aplicada direto no DOM: durante a digitação o traço vai até onde a frase chegou
  useLayoutEffect(() => {
    const elementoLinha = linha.current;
    const elementoDigitado = trechoDigitado.current;
    if (!elementoLinha || !elementoDigitado) return;
    const largura = linhaVoltou || saudacao === null
      ? LINHA_REPOUSO_PX
      : Math.max(LINHA_REPOUSO_PX, elementoDigitado.offsetWidth);
    elementoLinha.style.width = `${largura}px`;
  }, [digitados, linhaVoltou, saudacao]);

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

  function mostrarErros(novos: Erros) {
    setErros(novos);
    setTremor((atual) => ({
      email: novos.email ? atual.email + 1 : atual.email,
      senha: novos.senha ? atual.senha + 1 : atual.senha,
    }));
    (novos.email ? campoEmail : campoSenha).current?.focus();
  }

  function tremorDe(campo: Campo) {
    if (!erros[campo]) return undefined;
    return tremor[campo] % 2 === 1 ? "a" : "b";
  }

  function limparErro(campo: Campo) {
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }));
  }

  function entrar() {
    if (entrando) return;
    const emailLimpo = email.trim();
    const novos: Erros = {};
    if (!emailLimpo) novos.email = MENSAGENS.emailVazio;
    else if (!EMAIL_VALIDO.test(emailLimpo)) novos.email = MENSAGENS.emailIncompleto;
    if (!senha) novos.senha = MENSAGENS.senhaVazia;
    if (novos.email || novos.senha) {
      mostrarErros(novos);
      return;
    }

    setErros({});
    setEntrando(true);
    timer.current = setTimeout(() => {
      const resultado = autenticar(emailLimpo, senha);
      if (resultado.ok) {
        router.push("/dashboard");
        return;
      }
      setEntrando(false);
      const { campo, mensagem } = ERROS_AUTENTICACAO[resultado.erro];
      mostrarErros({ [campo]: mensagem });
    }, ATRASO_ENTRADA_MS);
  }

  // ainda sem provedor: entra direto com a conta de teste, sem validar os campos do formulário
  function entrarComGoogle() {
    if (entrando) return;
    setErros({});
    setEntrando(true);
    timer.current = setTimeout(() => {
      login(CONTA_TESTE.email);
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
        <form className="login-form" onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
          <div className="login-eyebrow" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "clamp(10px, 2vh, 20px)" }}>
            <span className="eyebrow" style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
              Entrar na conta
            </span>
            <span style={{ flex: 1, maxWidth: 110, height: 1, background: "var(--color-divider)" }} />
          </div>
          <h1
            ref={titulo}
            aria-label={textoCompleto}
            data-digitando={digitando ? "true" : "false"}
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
            <span ref={trechoDigitado}>{textoDigitado}</span>
            {digitando && <span className="login-cursor" aria-hidden="true" />}
            {/* o resto invisível segura a largura final, então o ajuste de fonte mede a frase inteira */}
            <span aria-hidden="true" style={{ visibility: "hidden" }}>
              {textoRestante}
            </span>
          </h1>
          <div
            ref={linha}
            data-testid="linha-saudacao"
            data-estado={linhaVoltou ? "repouso" : digitacaoCompleta ? "cheia" : "digitando"}
            style={{
              height: 1,
              background: "var(--color-accent)",
              marginBottom: "clamp(16px, 3vh, 32px)",
              transition: linhaVoltou ? "width 0.7s cubic-bezier(0.22, 1, 0.36, 1)" : "width 90ms linear",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(10px, 1.8vh, 16px)", marginBottom: 8 }}>
            {/* o nome do campo fica no placeholder; o label segue só para leitor de tela */}
            <div className="field">
              <label htmlFor="login-email" className="sr-only">E-mail</label>
              <input
                ref={campoEmail}
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="E-mail"
                aria-invalid={erros.email ? true : undefined}
                aria-describedby={erros.email ? "login-erro-email" : undefined}
                data-tremor={tremorDe("email")}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  limparErro("email");
                }}
                style={{ minHeight: 50, fontSize: 16, padding: "12px 18px" }}
              />
              {erros.email && <MensagemErro id="login-erro-email">{erros.email}</MensagemErro>}
            </div>
            <div className="field">
              <label htmlFor="login-senha" className="sr-only">Senha</label>
              {/* com foco em qualquer parte do campo (input ou olho), o olho do mascote se projeta à frente */}
              <div
                className="login-senha-campo"
                data-tremor={tremorDe("senha")}
                style={{ position: "relative", display: "flex", alignItems: "center" }}
              >
                <input
                  ref={campoSenha}
                  id="login-senha"
                  className="input"
                  type={verSenha ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Senha"
                  aria-invalid={erros.senha ? true : undefined}
                  aria-describedby={erros.senha ? "login-erro-senha" : undefined}
                  value={senha}
                  onChange={(event) => {
                    setSenha(event.target.value);
                    limparErro("senha");
                  }}
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
              {erros.senha && <MensagemErro id="login-erro-senha">{erros.senha}</MensagemErro>}
            </div>
          </div>

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
            {/* abre o card de recuperação; o envio do código é simulado até a autenticação real (#5) */}
            <button
              ref={gatilhoRecuperar}
              type="button"
              className="login-link-animado"
              aria-haspopup="dialog"
              style={{ fontSize: 14.5 }}
              onPointerEnter={precarregarRecuperarSenha}
              onFocus={precarregarRecuperarSenha}
              onClick={() => {
                setRecuperarCarregado(true);
                setRecuperarAberto(true);
              }}
            >
              Esqueci a senha
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={entrando}
            style={{ fontSize: 15.5, padding: "clamp(10px, 1.6vh, 13px) 22px", marginTop: 0 }}
          >
            {entrando ? "Entrando…" : "Entrar"}
          </button>

          <div className="login-divisor" style={{ display: "flex", alignItems: "center", gap: 14, margin: "clamp(14px, 2.6vh, 26px) 0" }}>
            <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
            <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 46%, transparent)" }}>
              ou
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
          </div>

          {/* só o símbolo do Google aparece; no hover, faixas inclinadas com as cores da marca ocupam metade do botão */}
          <button
            type="button"
            className="btn btn-secondary login-google"
            aria-label="Entrar com Google"
            disabled={entrando}
            onClick={entrarComGoogle}
          >
            {/* quatro faixas de largura igual, inclinadas no mesmo ângulo */}
            <span className="login-google-painel" aria-hidden="true">
              <span className="login-google-faixa g-azul" />
              <span className="login-google-faixa g-vermelho" />
              <span className="login-google-faixa g-amarelo" />
              <span className="login-google-faixa g-verde" />
            </span>
            {/* o "G" com as cores do Google (cores no globals.css) */}
            <span className="login-google-simbolo" aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <path className="g-amarelo" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path className="g-vermelho" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path className="g-verde" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path className="g-azul" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
            </span>
          </button>

          <p className="login-criar" style={{ margin: "clamp(14px, 2.8vh, 28px) 0 0", fontSize: 14.5, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            Ainda não tem conta?{" "}
            <a href="#" className="login-link-animado">
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

      {recuperarCarregado && (
        <RecuperarSenha
          aberto={recuperarAberto}
          emailInicial={email.trim()}
          onFechar={() => {
            setRecuperarAberto(false);
            gatilhoRecuperar.current?.focus();
          }}
        />
      )}
    </div>
  );
}

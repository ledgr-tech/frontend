"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { demoAberta } from "@/lib/demo";
import { estaBloqueado, limparTentativas, registrarSenhaErrada } from "@/lib/tentativas";
import {
  entrar as abrirSessao,
  entrarNaDemonstracao,
  type ErroEntrada,
  type ResultadoEntrada,
} from "../acoes";
import dynamic from "next/dynamic";
import { CampoTexto } from "../_compartilhado/campo-texto";
import { EMAIL_VALIDO, MENSAGEM_EMAIL_INCOMPLETO } from "../_compartilhado/validacao";
import { CHAVE_SAUDACAO, SAUDACOES, escolherSaudacao } from "./saudacoes";

// o card de recuperação (e o motion que ele usa) fica fora do carregamento inicial do login:
// só é baixado quando alguém se aproxima de "Esqueci a senha"
const RecuperarSenha = dynamic(() => import("./recuperar-senha").then((modulo) => modulo.RecuperarSenha), {
  ssr: false,
});

function precarregarRecuperarSenha() {
  void import("./recuperar-senha");
}

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
  emailVazio: "Informe seu e-mail.",
  emailIncompleto: MENSAGEM_EMAIL_INCOMPLETO,
  senhaVazia: "Informe sua senha.",
};

// o que o servidor devolve, mais a pausa depois de senhas erradas seguidas
type ErroLogin = ErroEntrada | "muitas_tentativas";

// erros devolvidos pela autenticação, cada um mostrado junto ao campo a que se refere
const ERROS_LOGIN: Record<ErroLogin, { campo: Campo; mensagem: string }> = {
  conta_nao_encontrada: { campo: "email", mensagem: "Não encontramos conta com este e-mail. Confira o endereço." },
  senha_incorreta: { campo: "senha", mensagem: "Senha incorreta. Confira e tente de novo." },
  // "alguns minutos" e não um tempo exato: quem tenta de novo durante o bloqueio pega só o que falta dele
  muitas_tentativas: { campo: "senha", mensagem: "Acesso pausado por segurança. Tente de novo em alguns minutos." },
  // Não é erro de quem digitou: ambiente mal configurado (NEXTAUTH_SECRET,
  // LEDGR_EMPRESA_ID_TESTE ou a conta de teste faltando) ou servidor fora do
  // ar. Mensagem separada pra não acusar o usuário.
  falha_sessao: { campo: "senha", mensagem: "Não foi possível abrir a sessão. Tente de novo em instantes." },
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
    setSemAnimacao(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
    setSaudacao(SAUDACOES[indice]);
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
    timer.current = setTimeout(async () => {
      // quem confere a senha é o servidor; daqui só sai a pausa depois de erros seguidos
      if (estaBloqueado()) return falhar("muitas_tentativas");
      let resultado: ResultadoEntrada;
      try {
        resultado = await abrirSessao(emailLimpo, senha, manterSessao);
      } catch {
        // a action nem respondeu (rede, deploy novo no meio): para quem digitou, é a mesma falha
        return falhar("falha_sessao");
      }
      if (resultado.ok) {
        limparTentativas();
        router.push("/visao-geral");
        return;
      }
      const pausou = resultado.erro === "senha_incorreta" && registrarSenhaErrada();
      falhar(pausou ? "muitas_tentativas" : resultado.erro);
    }, ATRASO_ENTRADA_MS);
  }

  function falhar(erro: ErroLogin) {
    setEntrando(false);
    const { campo, mensagem } = ERROS_LOGIN[erro];
    mostrarErros({ [campo]: mensagem });
  }

  // ainda sem provedor: é o atalho de demonstração, sem validar os campos do formulário
  function entrarComGoogle() {
    if (entrando) return;
    setErros({});
    setEntrando(true);
    timer.current = setTimeout(async () => {
      const entrou = await entrarNaDemonstracao(manterSessao).catch(() => false);
      if (entrou) {
        router.push("/visao-geral");
        return;
      }
      falhar("falha_sessao");
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
              color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
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
            {/* rótulos flutuantes: começam dentro do campo e sobem para a borda ao focar ou preencher */}
            <CampoTexto
              ref={campoEmail}
              id="login-email"
              rotulo="E-mail"
              tipo="email"
              exemplo="nome@empresa.com.br"
              autoComplete="email"
              erro={erros.email}
              tremor={tremorDe("email")}
              valor={email}
              onValor={(valor) => {
                setEmail(valor);
                limparErro("email");
              }}
            />
            <CampoTexto
              ref={campoSenha}
              id="login-senha"
              rotulo="Senha"
              tipo="password"
              alternarSenha
              autoComplete="current-password"
              erro={erros.senha}
              tremor={tremorDe("senha")}
              valor={senha}
              onValor={(valor) => {
                setSenha(valor);
                limparErro("senha");
              }}
            />
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

          {/* atalho de demonstração: só aparece onde NEXT_PUBLIC_LEDGR_DEMO_ABERTA=1 (ver lib/demo.ts) */}
          {demoAberta() && (
            <>
            <div className="login-divisor" style={{ display: "flex", alignItems: "center", gap: 14, margin: "clamp(14px, 2.6vh, 26px) 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
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
            </>
          )}

          <p className="login-criar" style={{ margin: "clamp(14px, 2.8vh, 28px) 0 0", fontSize: 14.5, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="login-link-animado">
              Criar conta
            </Link>
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
          color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
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

"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { demoAberta } from "@/lib/demo";
import { destinoDepoisDoLogin } from "@/lib/rotas";
import { MENSAGEM_GOOGLE, ehErroGoogle, googleLigado } from "@/lib/google";
import { estaBloqueado, limparTentativas, registrarSenhaErrada } from "@/lib/tentativas";
import {
  entrar as abrirSessao,
  entrarComGoogle as irAoGoogle,
  entrarNaDemonstracao,
  type ErroEntrada,
  type ResultadoEntrada,
} from "../acoes";
import dynamic from "next/dynamic";
import { CampoTexto } from "../_compartilhado/campo-texto";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { MensagemErro } from "../_compartilhado/mensagem-erro";
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

// erros devolvidos pela autenticação, cada um mostrado junto ao campo a que se refere
const ERROS_LOGIN: Record<ErroEntrada, { campo: Campo; mensagem: string }> = {
  // uma mensagem só para e-mail sem conta e senha errada: o backend não diz qual dos dois,
  // de propósito, para ninguém descobrir pelo login quais e-mails têm conta
  credenciais_invalidas: { campo: "senha", mensagem: "E-mail ou senha incorretos. Confira e tente de novo." },
  // a pausa do navegador depois de erros seguidos e o limite do backend (10 entradas por minuto).
  // "alguns minutos" e não um tempo exato: quem tenta de novo durante o bloqueio pega só o que falta dele
  muitas_tentativas: { campo: "senha", mensagem: "Acesso pausado por segurança. Tente de novo em alguns minutos." },
  // Não é erro de quem digitou: ambiente mal configurado (NEXTAUTH_SECRET) ou
  // backend fora do ar. Mensagem separada pra não acusar o usuário.
  falha_sessao: { campo: "senha", mensagem: "Não foi possível abrir a sessão. Tente de novo em instantes." },
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
  // o motivo de o Google não ter aberto a sessão, que o callback manda em ?google= (ou o NextAuth em ?error=)
  const [erroGoogle, setErroGoogle] = useState<string>();
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
    const parametros = new URLSearchParams(window.location.search);
    const motivo = parametros.get("google");
    if (!motivo && !parametros.has("error")) return;
    // a URL só existe no navegador: ler no render daria uma tela no servidor e outra no cliente
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErroGoogle(MENSAGEM_GOOGLE[ehErroGoogle(motivo) ? motivo : "falha"]);
    // o motivo vale para esta volta do Google: recarregar a página não mostra de novo
    window.history.replaceState(null, "", window.location.pathname);
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
        router.push(destino());
        return;
      }
      const pausou = resultado.erro === "credenciais_invalidas" && registrarSenhaErrada();
      falhar(pausou ? "muitas_tentativas" : resultado.erro);
    }, ATRASO_ENTRADA_MS);
  }

  // quem chegou por um pedido de conexão (front #195) volta a ele depois de entrar
  function voltar(): string | null {
    return new URLSearchParams(window.location.search).get("voltar");
  }

  function destino(): string {
    return destinoDepoisDoLogin(voltar());
  }

  function falhar(erro: ErroEntrada) {
    setEntrando(false);
    const { campo, mensagem } = ERROS_LOGIN[erro];
    mostrarErros({ [campo]: mensagem });
  }

  // com o Google ligado, leva ao Google (a action sai redirecionando); sem ele, é o atalho que entra na
  // conta de demonstração. Nos dois casos, sem validar os campos do formulário
  function entrarComGoogle() {
    if (entrando) return;
    setErros({});
    setErroGoogle(undefined);
    setEntrando(true);
    if (googleLigado()) {
      irAoGoogle(voltar())
        .then(() => {
          setEntrando(false);
          setErroGoogle(MENSAGEM_GOOGLE.indisponivel);
        })
        .catch(() => {
          setEntrando(false);
          setErroGoogle(MENSAGEM_GOOGLE.falha);
        });
      return;
    }
    timer.current = setTimeout(async () => {
      const entrou = await entrarNaDemonstracao(manterSessao).catch(() => false);
      if (entrou) {
        router.push(destino());
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
    <MolduraAuth
      rotulo="Acesso"
      depois={
        recuperarCarregado && (
          <RecuperarSenha
            aberto={recuperarAberto}
            emailInicial={email.trim()}
            onFechar={() => {
              setRecuperarAberto(false);
              gatilhoRecuperar.current?.focus();
            }}
          />
        )
      }
    >
      <form className="login-form" onSubmit={enviar} noValidate>
        <div className="login-eyebrow">
          <span className="eyebrow login-eyebrow-texto">
            Entrar na conta
          </span>
          <span className="login-eyebrow-fio" />
        </div>
        <h1
          ref={titulo}
          aria-label={textoCompleto}
          data-digitando={digitando ? "true" : "false"}
          className="login-titulo"
          // só aparece depois do sorteio, para não piscar a saudação padrão do HTML estático
          style={{ opacity: saudacao ? 1 : 0 }}
        >
          <span ref={trechoDigitado}>{textoDigitado}</span>
          {digitando && <span className="login-cursor" aria-hidden="true" />}
          {/* o resto invisível segura a largura final, então o ajuste de fonte mede a frase inteira */}
          <span aria-hidden="true" className="login-titulo-resto">
            {textoRestante}
          </span>
        </h1>
        <div
          ref={linha}
          data-testid="linha-saudacao"
          data-estado={linhaVoltou ? "repouso" : digitacaoCompleta ? "cheia" : "digitando"}
          className="login-saudacao-linha"
        />

        <div className="login-campos">
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

        <div className="login-opcoes">
          <label className="login-manter">
            <input
              type="checkbox"
              checked={manterSessao}
              onChange={(event) => setManterSessao(event.target.checked)}
            />
            Manter sessão ativa
          </label>
          {/* abre o card de recuperação, que pede o link por e-mail ao backend (#66) */}
          <button
            ref={gatilhoRecuperar}
            type="button"
            className="link-animado"
            aria-haspopup="dialog"
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
          className="btn btn-primary btn-block login-entrar"
          disabled={entrando}
        >
          {entrando ? "Entrando…" : "Entrar"}
        </button>

        {/* o Google de verdade onde NEXT_PUBLIC_LEDGR_GOOGLE=1 (lib/google.ts); sem ele, o atalho de demonstração,
            onde NEXT_PUBLIC_LEDGR_DEMO_ABERTA=1 (lib/demo.ts) */}
        {(googleLigado() || demoAberta()) && (
          <>
          <div className="login-divisor">
            <span className="login-divisor-fio" />
            <span className="login-divisor-texto">ou</span>
            <span className="login-divisor-fio" />
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

        {erroGoogle && (
          <div className="login-erro-google">
            <MensagemErro id="login-erro-google">{erroGoogle}</MensagemErro>
          </div>
        )}

        <p className="login-criar">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="link-animado">
            Criar conta
          </Link>
        </p>
      </form>
    </MolduraAuth>
  );
}

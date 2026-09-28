"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { redefinirSenha, type ResultadoRedefinicao } from "../acoes";
import { CampoTexto } from "../_compartilhado/campo-texto";
import { MensagemErro } from "../_compartilhado/mensagem-erro";
import { MolduraAuth } from "../_compartilhado/moldura-auth";

/**
 * Onde cai o link do e-mail de "Esqueci a senha" (#66, ADR-012 no ledgr-docs):
 * `/redefinir-senha#token=...`. O token vem no fragmento, que o navegador não
 * manda ao servidor: não aparece no log da Vercel nem no `Referer`. A página lê
 * o token uma vez e tira ele da barra de endereço, para não ficar no histórico.
 *
 * Não abre sessão: quem redefiniu entra pelo login, com a senha que acabou de
 * criar. O backend manda um aviso de senha alterada para o e-mail da conta.
 */

// as mesmas regras do cadastro e do backend: 8 caracteres a 72 bytes (o bcrypt corta em 72)
const SENHA_MINIMA = 8;
const SENHA_MAXIMA_BYTES = 72;

type Etapa = "lendo" | "sem_token" | "formulario" | "enviando" | "concluido" | "link_invalido";
type ErroBackend = Extract<ResultadoRedefinicao, { ok: false }>["erro"];
type Erros = { senha?: string; confirmacao?: string; geral?: string };

const ERROS_BACKEND: Record<Exclude<ErroBackend, "link_invalido">, Erros> = {
  senha_invalida: { senha: `A senha precisa ter de ${SENHA_MINIMA} a ${SENHA_MAXIMA_BYTES} caracteres.` },
  muitas_tentativas: { geral: "Muitas tentativas. Espere um minuto e tente de novo." },
  falha: { geral: "Não foi possível salvar agora. Tente de novo em instantes." },
};

const estiloTitulo: CSSProperties = {
  margin: "0 0 clamp(8px, 1.5vh, 14px)",
  fontSize: "clamp(28px, 3.4vw, 38px)",
  fontWeight: 400,
  lineHeight: 1.12,
  letterSpacing: "-0.016em",
  textWrap: "balance",
};

const estiloTexto: CSSProperties = {
  margin: "0 0 clamp(16px, 2.6vh, 24px)",
  fontSize: 15,
  lineHeight: 1.65,
  color: "color-mix(in srgb, var(--color-text) 72%, transparent)",
};

const estiloBotao: CSSProperties = { fontSize: 15.5, padding: "clamp(10px, 1.6vh, 13px) 22px" };

function validar(senha: string, confirmacao: string): Erros {
  if (senha.length < SENHA_MINIMA) return { senha: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` };
  // acento conta 2 bytes
  if (new TextEncoder().encode(senha).length > SENHA_MAXIMA_BYTES) {
    return { senha: `Senha longa demais. Use no máximo ${SENHA_MAXIMA_BYTES} caracteres.` };
  }
  if (senha !== confirmacao) return { confirmacao: "A confirmação não bate com a senha nova." };
  return {};
}

export default function RedefinirSenhaPage() {
  const [etapa, setEtapa] = useState<Etapa>("lendo");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const token = useRef("");
  // o StrictMode roda o efeito duas vezes em dev: na segunda o fragmento já foi apagado
  const tokenLido = useRef(false);

  useEffect(() => {
    if (tokenLido.current) return;
    tokenLido.current = true;
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    // o fragmento só existe no navegador: não há como ler no primeiro render
    setEtapa(token.current ? "formulario" : "sem_token");
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (etapa !== "formulario") return;
    const invalidos = validar(senha, confirmacao);
    setErros(invalidos);
    if (Object.keys(invalidos).length > 0) return;

    setEtapa("enviando");
    const resultado = await redefinirSenha(token.current, senha).catch(
      (): ResultadoRedefinicao => ({ ok: false, erro: "falha" }),
    );
    if (resultado.ok) {
      setEtapa("concluido");
      return;
    }
    if (resultado.erro === "link_invalido") {
      setEtapa("link_invalido");
      return;
    }
    setErros(ERROS_BACKEND[resultado.erro]);
    setEtapa("formulario");
  }

  if (etapa === "lendo") return <MolduraAuth rotulo="Nova senha">{null}</MolduraAuth>;

  if (etapa === "sem_token" || etapa === "link_invalido" || etapa === "concluido") {
    const aviso = {
      sem_token: {
        titulo: "Este link está incompleto.",
        texto: "Abra o link direto do e-mail, sem cortar nenhuma parte, ou peça um novo em “Esqueci a senha”, na tela de login.",
        acao: "Ir para o login",
      },
      link_invalido: {
        titulo: "Este link não vale mais.",
        texto: "O link vale por 30 minutos e só pode ser usado uma vez. Peça um novo em “Esqueci a senha”, na tela de login.",
        acao: "Pedir um novo link",
      },
      concluido: {
        titulo: "Senha redefinida.",
        texto: "Enviamos um aviso para o seu e-mail. Agora é só entrar com a senha nova.",
        acao: "Entrar",
      },
    }[etapa];
    return (
      <MolduraAuth rotulo="Nova senha">
        <div style={{ width: "100%", maxWidth: 424 }}>
          <h1 style={estiloTitulo}>{aviso.titulo}</h1>
          <p style={estiloTexto}>{aviso.texto}</p>
          <Link href="/login" className="btn btn-primary btn-block" style={estiloBotao}>
            {aviso.acao}
          </Link>
        </div>
      </MolduraAuth>
    );
  }

  const enviando = etapa === "enviando";
  const senhaAtendida = senha.length >= SENHA_MINIMA;
  return (
    <MolduraAuth rotulo="Nova senha">
      <form className="login-form" onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
        <h1 style={estiloTitulo}>Crie uma senha nova.</h1>
        <p style={estiloTexto}>Ela passa a valer na hora. Depois, é só entrar com o seu e-mail e a senha nova.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(10px, 1.8vh, 16px)" }}>
          <CampoTexto
            id="redefinir-senha"
            rotulo="Senha nova"
            tipo="password"
            alternarSenha
            autoComplete="new-password"
            disabled={enviando}
            erro={erros.senha}
            ajudaId="redefinir-senha-requisito"
            valor={senha}
            onValor={(valor) => {
              setSenha(valor);
              if (erros.senha) setErros({});
            }}
          >
            {/* o requisito fica visível desde o início e marca quando é atendido, como no cadastro */}
            <p id="redefinir-senha-requisito" data-atendido={senhaAtendida} className="campo-requisito">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                {senhaAtendida ? <path d="M3.5 8.4l2.9 2.9 6.1-6.6" /> : <circle cx="8" cy="8" r="5.4" />}
              </svg>
              Pelo menos {SENHA_MINIMA} caracteres
              {senhaAtendida && <span className="sr-only"> (atendido)</span>}
            </p>
          </CampoTexto>
          <CampoTexto
            id="redefinir-confirmacao"
            rotulo="Repita a senha nova"
            tipo="password"
            alternarSenha
            autoComplete="new-password"
            disabled={enviando}
            erro={erros.confirmacao}
            valor={confirmacao}
            onValor={(valor) => {
              setConfirmacao(valor);
              if (erros.confirmacao) setErros({});
            }}
          />
        </div>

        {erros.geral && (
          <div style={{ marginTop: "clamp(12px, 2vh, 16px)" }}>
            <MensagemErro id="redefinir-erro">{erros.geral}</MensagemErro>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={enviando}
          style={{ ...estiloBotao, marginTop: "clamp(16px, 2.6vh, 24px)" }}
        >
          {enviando ? "Salvando…" : "Salvar senha nova"}
        </button>
      </form>
    </MolduraAuth>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { confirmarEmail, type ResultadoConfirmacaoEmail } from "../acoes";
import { MensagemErro } from "../_compartilhado/mensagem-erro";
import { MolduraAuth } from "../_compartilhado/moldura-auth";

/**
 * Onde cai o link da troca de e-mail (backend #149, ADR-012 com o adendo de 22/10):
 * `/confirmar-email#token=...`, enviado ao e-mail novo. O token vem no fragmento, como no
 * `/redefinir-senha`: não chega ao servidor nem ao `Referer`, e a página tira ele da barra.
 *
 * A confirmação é um clique, não automática ao abrir: o leitor de links de alguns e-mails abre a
 * página sozinho, e o token é de uso único. Confirmado, o backend encerra todas as sessões; a pessoa
 * entra de novo com o e-mail novo.
 */

const VALIDADE_LINK_MINUTOS = 60;

type Etapa = "lendo" | "sem_token" | "pronto" | "enviando" | "concluido" | "link_invalido" | "email_em_uso";
type ErroConfirmacao = Extract<ResultadoConfirmacaoEmail, { ok: false }>["erro"];

const ERROS_GERAIS: Record<Exclude<ErroConfirmacao, "link_invalido" | "email_em_uso">, string> = {
  muitas_tentativas: "Muitas tentativas. Espere um minuto e tente de novo.",
  falha: "Não foi possível confirmar agora. Tente de novo em instantes.",
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

// a página toda é sobre o e-mail que chegou: o mascote do envelope abre cada estado
const mascote = (
  <Image
    src="/mascotes/mascote-envelope.png"
    alt=""
    width={555}
    height={720}
    sizes="88px"
    priority
    style={{ width: 88, height: "auto", display: "block", marginBottom: "clamp(10px, 2vh, 18px)" }}
  />
);

export default function ConfirmarEmailPage() {
  const [etapa, setEtapa] = useState<Etapa>("lendo");
  const [erro, setErro] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
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
    setEtapa(token.current ? "pronto" : "sem_token");
  }, []);

  async function confirmar() {
    if (etapa !== "pronto") return;
    setEtapa("enviando");
    setErro("");
    const resultado = await confirmarEmail(token.current).catch(
      (): ResultadoConfirmacaoEmail => ({ ok: false, erro: "falha" }),
    );
    if (resultado.ok) {
      setEmailNovo(resultado.email);
      setEtapa("concluido");
      return;
    }
    if (resultado.erro === "link_invalido" || resultado.erro === "email_em_uso") {
      setEtapa(resultado.erro);
      return;
    }
    setErro(ERROS_GERAIS[resultado.erro]);
    setEtapa("pronto");
  }

  if (etapa === "lendo") return <MolduraAuth rotulo="Novo e-mail">{null}</MolduraAuth>;

  if (etapa !== "pronto" && etapa !== "enviando") {
    const aviso = {
      sem_token: {
        titulo: "Este link está incompleto.",
        texto: "Abra o link direto do e-mail, sem cortar nenhuma parte, ou peça a troca de novo em Configurações › Conta.",
        acao: "Ir para o login",
      },
      link_invalido: {
        titulo: "Este link não vale mais.",
        texto: `O link vale por ${VALIDADE_LINK_MINUTOS} minutos, só pode ser usado uma vez e deixa de valer quando você pede outra troca. Peça de novo em Configurações › Conta.`,
        acao: "Ir para o login",
      },
      email_em_uso: {
        titulo: "Este e-mail já tem uma conta.",
        texto: "Enquanto o link esperava, outra conta passou a usar este e-mail. O seu continua o mesmo; para trocar, escolha outro em Configurações › Conta.",
        acao: "Ir para o login",
      },
      concluido: {
        titulo: "E-mail trocado.",
        texto: `Agora você entra no Ledgr com ${emailNovo}. Por segurança, encerramos as suas sessões abertas e avisamos o e-mail antigo.`,
        acao: "Entrar",
      },
    }[etapa];
    return (
      <MolduraAuth rotulo="Novo e-mail">
        <div style={{ width: "100%", maxWidth: 424 }}>
          {mascote}
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
  return (
    <MolduraAuth rotulo="Novo e-mail">
      <div style={{ width: "100%", maxWidth: 424 }}>
        {mascote}
        <h1 style={estiloTitulo}>Confirme o seu e-mail novo.</h1>
        <p style={estiloTexto}>
          Depois de confirmar, você passa a entrar no Ledgr com este e-mail, e as sessões abertas são encerradas.
        </p>
        {erro && (
          <div style={{ marginBottom: "clamp(12px, 2vh, 16px)" }}>
            <MensagemErro id="confirmar-email-erro">{erro}</MensagemErro>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={enviando}
          onClick={confirmar}
          style={estiloBotao}
        >
          {enviando ? "Confirmando…" : "Confirmar e-mail novo"}
        </button>
      </div>
    </MolduraAuth>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { confirmarEmail, type ResultadoConfirmacaoEmail } from "../acoes";
import { MensagemErro } from "../_compartilhado/mensagem-erro";
import { MolduraAuth } from "../_compartilhado/moldura-auth";

/**
 * Onde cai o link da troca de e-mail (backend #149): `/confirmar-email#token=...`, enviado ao e-mail
 * novo. O token vem no fragmento, como na redefinição de senha, e sai da barra de endereço assim que
 * é lido. A troca espera o clique em "Confirmar": leitor de link de e-mail que roda JavaScript
 * gastaria o token de uso único se a página confirmasse sozinha.
 *
 * No sucesso o backend encerra todas as sessões da conta; a pessoa entra de novo com o e-mail novo.
 */

type Etapa = "lendo" | "sem_token" | "pronto" | "enviando" | "concluido" | "link_invalido" | "email_em_uso";
type ErroConfirmacao = Extract<ResultadoConfirmacaoEmail, { ok: false }>["erro"];

const ERROS_NA_TELA: Record<Exclude<ErroConfirmacao, "link_invalido" | "email_em_uso">, string> = {
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

export default function ConfirmarEmailPage() {
  const [etapa, setEtapa] = useState<Etapa>("lendo");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
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
      setEmail(resultado.email);
      setEtapa("concluido");
      return;
    }
    if (resultado.erro === "link_invalido" || resultado.erro === "email_em_uso") {
      setEtapa(resultado.erro);
      return;
    }
    setErro(ERROS_NA_TELA[resultado.erro]);
    setEtapa("pronto");
  }

  if (etapa === "lendo") return <MolduraAuth rotulo="Novo e-mail">{null}</MolduraAuth>;

  if (etapa === "pronto" || etapa === "enviando") {
    const enviando = etapa === "enviando";
    return (
      <MolduraAuth rotulo="Novo e-mail">
        <div style={{ width: "100%", maxWidth: 424 }}>
          <h1 style={estiloTitulo}>Confirme o seu e-mail novo.</h1>
          <p style={estiloTexto}>
            Ao confirmar, ele passa a ser o e-mail de entrada no Ledgr, e as sessões abertas se encerram.
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
            {enviando ? "Confirmando…" : "Confirmar"}
          </button>
        </div>
      </MolduraAuth>
    );
  }

  const aviso = {
    sem_token: {
      titulo: "Este link está incompleto.",
      texto: "Abra o link direto do e-mail, sem cortar nenhuma parte, ou peça a troca de novo em Configurações › Conta.",
      acao: "Ir para o login",
    },
    link_invalido: {
      titulo: "Este link não vale mais.",
      texto: "O link vale por 60 minutos e só pode ser usado uma vez. Peça a troca de novo em Configurações › Conta.",
      acao: "Ir para o login",
    },
    email_em_uso: {
      titulo: "Este e-mail já tem conta.",
      texto: "Outra conta passou a usar este e-mail depois do seu pedido. O seu e-mail de entrada continua o mesmo.",
      acao: "Ir para o login",
    },
    concluido: {
      titulo: "E-mail trocado.",
      texto: `Agora você entra com ${email}. Avisamos o e-mail antigo da troca.`,
      acao: "Entrar",
    },
  }[etapa];
  return (
    <MolduraAuth rotulo="Novo e-mail">
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

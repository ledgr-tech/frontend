"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { ConsultaConvite } from "@/lib/adaptadores";
import { MENSAGEM_GOOGLE, type ErroConviteGoogle } from "@/lib/google";
import {
  aceitarConvite,
  aceitarConviteComGoogle,
  consultarConvite,
  sairParaAceitarConvite,
  type ResultadoAceite,
} from "../acoes";
import { CampoTexto } from "../_compartilhado/campo-texto";
import { MensagemErro } from "../_compartilhado/mensagem-erro";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { MascoteDoRelogio } from "../_compartilhado/mascote-do-relogio";
import { SENHA_MINIMA, validarSenhaNova } from "../_compartilhado/validacao";

/**
 * Onde cai o link do e-mail de convite (backend #69): `/aceitar-convite#token=...`.
 * O token vem no fragmento, que o navegador não manda ao servidor, como na
 * redefinição de senha: a página lê uma vez, guarda na memória e tira da barra
 * de endereço. Antes de pedir qualquer coisa, consulta o convite, para mostrar
 * para onde a pessoa está entrando.
 */

export type GoogleNoConvite = {
  /** `NEXT_PUBLIC_LEDGR_GOOGLE=1`: mostra "Aceitar com Google". */
  ligado: boolean;
  /** O motivo de o Google não ter aceitado o convite, que volta em `?google=`. */
  erro: ErroConviteGoogle | null;
  /** O convite do cookie, consultado pelo servidor nessa volta (o fragmento se perdeu na ida ao Google). */
  convite: ConsultaConvite | null;
};

type Etapa = "lendo" | "invalido" | "conectado" | "formulario" | "enviando";
type Erros = { nome?: string; senha?: string; confirmacao?: string; geral?: string; jaTemConta?: boolean };

const INVALIDO = "Este convite expirou ou já foi usado. Peça um novo a quem convidou.";

const ERROS_DO_ACEITE: Record<Exclude<Extract<ResultadoAceite, { ok: false }>["erro"], "convite_invalido">, Erros> = {
  email_cadastrado: { geral: "Este e-mail já tem conta no Ledgr. Entre com ela.", jaTemConta: true },
  senha_invalida: { senha: `A senha precisa ter de ${SENHA_MINIMA} a 72 caracteres.` },
  // a conta de quem convidou foi inativada pelo Ledgr (backend #156): o convite volta a valer na reativação
  conta_inativa: { geral: "A conta que enviou este convite está inativa e não recebe pessoas novas agora. Fale com quem convidou." },
  muitas_tentativas: { geral: "Muitas tentativas seguidas. Espere um minuto e tente de novo." },
  falha: { geral: "Não foi possível agora. Tente de novo em instantes." },
};

// a action nem chegou ao servidor: recarregar não adianta, o token já saiu do endereço (e o digitado se perde)
const SEM_RESPOSTA = "Não foi possível agora. Tente de novo em instantes. Se não der, abra de novo o link do e-mail e preencha outra vez.";
const SEM_RESPOSTA_AO_ABRIR = "Não foi possível abrir o convite agora. Abra de novo o link do e-mail.";
const SEM_RESPOSTA_DO_GOOGLE = "Não foi possível agora. Tente de novo em instantes. Se não der, abra de novo o link do e-mail.";

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

/** O que a página diz na volta do Google com recusa, com o convite já na tela. */
function errosDaVolta(erro: Exclude<ErroConviteGoogle, "convite_invalido">, convite: ConsultaConvite): Erros {
  if (erro === "email_diferente") return { geral: `Entre no Google com ${convite.email} para aceitar.` };
  if (erro === "email_cadastrado" || erro === "conta_inativa") return ERROS_DO_ACEITE[erro];
  return { geral: MENSAGEM_GOOGLE[erro] };
}

export function AceitarConvite({ conectadoComo, google }: { conectadoComo: string | null; google: GoogleNoConvite }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>("lendo");
  const [convite, setConvite] = useState<ConsultaConvite | null>(null);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erros, setErros] = useState<Erros>({});
  const token = useRef("");
  // o StrictMode roda o efeito duas vezes em dev: na segunda o fragmento já foi apagado
  const tokenLido = useRef(false);

  async function consultar() {
    const resposta = await consultarConvite(token.current).catch(() => null);
    if (resposta?.ok) {
      setConvite(resposta.convite);
      setEtapa("formulario");
      return;
    }
    if (!resposta) setErros({ geral: SEM_RESPOSTA_AO_ABRIR });
    else if (resposta.erro !== "convite_invalido") setErros({ geral: ERROS_DO_ACEITE[resposta.erro].geral });
    setEtapa("invalido");
  }

  useEffect(() => {
    if (tokenLido.current) return;
    tokenLido.current = true;
    if (google.erro) {
      // a volta do Google com recusa: o token ficou no cookie e o convite veio consultado pelo servidor.
      // O motivo vale para esta volta: recarregar a página não mostra de novo, mas o "volta" mantém o convite
      window.history.replaceState(null, "", `${window.location.pathname}?google=volta`);
      if (google.convite && google.erro !== "convite_invalido") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConvite(google.convite);
        setErros(errosDaVolta(google.erro, google.convite));
        setEtapa("formulario");
      } else {
        setEtapa("invalido");
      }
      return;
    }
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    if (!token.current && google.convite && !conectadoComo) {
      // recarregar a volta do Google: o fragmento se perdeu, mas o cookie mantém o convite
      setConvite(google.convite);
      setEtapa("formulario");
      return;
    }
    if (token.current && !conectadoComo) {
      void consultar();
      return;
    }
    // o fragmento só existe no navegador: não há como ler no primeiro render
    setEtapa(token.current ? "conectado" : "invalido");
    // lê o link uma vez só, ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function irAoGoogle() {
    setErros({});
    // a action sai redirecionando para o Google; só volta quando não há como ir
    // false é o Google desligado no servidor; null, a action que nem chegou lá
    const foi = await aceitarConviteComGoogle(token.current).catch(() => null);
    setErros({ geral: foi === null ? SEM_RESPOSTA_DO_GOOGLE : MENSAGEM_GOOGLE.indisponivel });
  }

  async function sairEContinuar() {
    setEtapa("lendo");
    await sairParaAceitarConvite().catch(() => undefined);
    await consultar();
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (etapa !== "formulario" || !convite) return;
    const invalidos: Erros = nome.trim() ? validarSenhaNova(senha, confirmacao) : { nome: "Informe seu nome." };
    setErros(invalidos);
    if (Object.keys(invalidos).length > 0) return;

    setEtapa("enviando");
    const resultado = await aceitarConvite(token.current, convite.email, nome.trim(), senha).catch(() => null);
    if (!resultado) {
      setErros({ geral: SEM_RESPOSTA });
      setEtapa("formulario");
      return;
    }
    if (resultado.ok) {
      router.push(resultado.entrou ? "/visao-geral" : "/login");
      return;
    }
    if (resultado.erro === "convite_invalido") {
      setEtapa("invalido");
      return;
    }
    setErros(ERROS_DO_ACEITE[resultado.erro]);
    setEtapa("formulario");
  }

  if (etapa === "lendo") {
    return (
      <MolduraAuth rotulo="Convite">
        <p style={estiloTexto} role="status">
          Conferindo o convite…
        </p>
      </MolduraAuth>
    );
  }

  if (etapa === "invalido") {
    return (
      <MolduraAuth rotulo="Convite">
        <div style={{ width: "100%", maxWidth: 424 }}>
          {/* outras recusas (conta inativa, servidor fora) também caem aqui: o relógio é só do convite vencido */}
          {(erros.geral ?? INVALIDO) === INVALIDO && <MascoteDoRelogio />}
          <h1 style={estiloTitulo}>Convite indisponível.</h1>
          <p style={estiloTexto}>{erros.geral ?? INVALIDO}</p>
          <Link href="/login" className="btn btn-primary btn-block" style={estiloBotao}>
            Ir para o login
          </Link>
        </div>
      </MolduraAuth>
    );
  }

  if (etapa === "conectado") {
    return (
      <MolduraAuth rotulo="Convite">
        <div style={{ width: "100%", maxWidth: 424 }}>
          <h1 style={estiloTitulo}>Você já está conectado.</h1>
          <p style={estiloTexto}>
            Você está conectado como {conectadoComo}. Para aceitar este convite, saia primeiro.
          </p>
          <button type="button" className="btn btn-primary btn-block" style={estiloBotao} onClick={() => void sairEContinuar()}>
            Sair e continuar
          </button>
        </div>
      </MolduraAuth>
    );
  }

  const enviando = etapa === "enviando";
  return (
    <MolduraAuth rotulo="Convite">
      <form className="login-form" onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
        {/* quem aceita um convite entra numa equipe: a dupla de mascotes recebe */}
        <Image
          src="/mascotes/mascote-dupla.png"
          alt=""
          width={979}
          height={720}
          sizes="128px"
          loading="eager"
          style={{ width: 128, height: "auto", display: "block", marginBottom: "clamp(10px, 2vh, 18px)" }}
        />
        <h1 style={estiloTitulo}>Entrar na {convite?.razaoSocial}</h1>
        <p style={{ ...estiloTexto, marginBottom: 4 }}>
          <strong>{convite?.email}</strong>
        </p>
        <p style={estiloTexto}>O convite vale até {convite?.valeAte}</p>

        {google.ligado && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={estiloBotao}
              disabled={enviando}
              onClick={() => void irAoGoogle()}
            >
              Aceitar com Google
            </button>
            <div className="login-divisor" style={{ display: "flex", alignItems: "center", gap: 14, margin: "clamp(14px, 2.6vh, 22px) 0" }}>
              <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
              <span style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
                ou
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
            </div>
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(10px, 1.8vh, 16px)" }}>
          <CampoTexto
            id="convite-nome"
            rotulo="Seu nome"
            autoComplete="name"
            autoCapitalize="words"
            disabled={enviando}
            erro={erros.nome}
            valor={nome}
            onValor={(valor) => {
              setNome(valor);
              if (erros.nome) setErros({});
            }}
          />
          <CampoTexto
            id="convite-senha"
            rotulo="Senha"
            tipo="password"
            alternarSenha
            autoComplete="new-password"
            disabled={enviando}
            erro={erros.senha}
            valor={senha}
            onValor={(valor) => {
              setSenha(valor);
              if (erros.senha) setErros({});
            }}
          />
          <CampoTexto
            id="convite-confirmacao"
            rotulo="Repita a senha"
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
            <MensagemErro id="convite-erro">{erros.geral}</MensagemErro>
            {erros.jaTemConta && (
              <Link href="/login" className="btn btn-secondary btn-block" style={{ ...estiloBotao, marginTop: 12 }}>
                Entrar
              </Link>
            )}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={enviando}
          style={{ ...estiloBotao, marginTop: "clamp(16px, 2.6vh, 24px)" }}
        >
          {enviando ? "Criando a conta…" : "Criar conta e entrar"}
        </button>
      </form>
    </MolduraAuth>
  );
}

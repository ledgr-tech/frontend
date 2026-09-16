"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { CampoTexto } from "../_compartilhado/campo-texto";
import { MolduraAuth } from "../_compartilhado/moldura-auth";
import { TituloDigitado } from "../_compartilhado/titulo-digitado";
import { EMAIL_VALIDO, MENSAGEM_EMAIL_INCOMPLETO } from "../_compartilhado/validacao";
import { PASSOS, SENHA_MINIMA, type CampoCadastro } from "./passos";

// mesma pausa do login: dá tempo de ler "Concluindo…" antes de trocar de tela
const ATRASO_CONCLUSAO_MS = 700;

type Valores = Record<string, string>;
type Erros = Record<string, string | undefined>;

function validarCampo(campo: CampoCadastro, valor: string): string | undefined {
  const limpo = valor.trim();
  if (!limpo) return campo.mensagemVazio;
  if (campo.tipo === "email" && !EMAIL_VALIDO.test(limpo)) return MENSAGEM_EMAIL_INCOMPLETO;
  if (campo.tipo === "password" && valor.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  return campo.validar?.(limpo);
}

export default function CadastroPage() {
  const router = useRouter();
  const [indicePasso, setIndicePasso] = useState(0);
  const [valores, setValores] = useState<Valores>({});
  const [erros, setErros] = useState<Erros>({});
  // contador por campo: cada erro novo alterna data-tremor entre "a" e "b" para o CSS repetir o tremor
  const [tremor, setTremor] = useState<Record<string, number>>({});
  const [concluindo, setConcluindo] = useState(false);
  const campos = useRef<Record<string, HTMLInputElement | null>>({});
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const passo = PASSOS[indicePasso];
  const ultimoPasso = indicePasso === PASSOS.length - 1;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // ao trocar de passo o foco vai para o título novo, para o leitor de tela anunciar onde a pessoa está
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    titulo.current?.focus();
  }, [indicePasso]);

  function alterar(id: string, valor: string) {
    setValores((atual) => ({ ...atual, [id]: valor }));
    if (erros[id]) setErros((atual) => ({ ...atual, [id]: undefined }));
  }

  function tremorDe(id: string) {
    if (!erros[id]) return undefined;
    return (tremor[id] ?? 0) % 2 === 1 ? "a" : "b";
  }

  function avancar() {
    if (concluindo) return;
    const novos: Erros = {};
    for (const campo of passo.campos) {
      const mensagem = validarCampo(campo, valores[campo.id] ?? "");
      if (mensagem) novos[campo.id] = mensagem;
    }
    const invalidos = passo.campos.filter((campo) => novos[campo.id]);
    if (invalidos.length > 0) {
      setErros(novos);
      setTremor((atual) => {
        const proximo = { ...atual };
        for (const campo of invalidos) proximo[campo.id] = (atual[campo.id] ?? 0) + 1;
        return proximo;
      });
      campos.current[invalidos[0].id]?.focus();
      return;
    }

    setErros({});
    if (ultimoPasso) {
      setConcluindo(true);
      timer.current = setTimeout(() => {
        login((valores.email ?? "").trim());
        router.push("/conciliacoes/nova");
      }, ATRASO_CONCLUSAO_MS);
      return;
    }

    const proximoPasso = PASSOS[indicePasso + 1];
    // o e-mail do responsável começa igual ao e-mail de acesso
    if (proximoPasso.id === "sistema" && !valores.emailResponsavel) {
      setValores((atual) => ({ ...atual, emailResponsavel: (atual.email ?? "").trim() }));
    }
    setIndicePasso(indicePasso + 1);
  }

  function voltar() {
    setErros({});
    setIndicePasso((atual) => Math.max(0, atual - 1));
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    avancar();
  }

  return (
    <MolduraAuth rotulo="Cadastro" larguraConteudo={884} linhaDireitaNaBorda>
      <div className="cadastro-grid">
      <form className="login-form" onSubmit={enviar} noValidate style={{ width: "100%", maxWidth: 424 }}>
        <div className="login-eyebrow" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "clamp(10px, 2vh, 20px)" }}>
          <span className="eyebrow" style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-accent-700)" }}>
            {passo.eyebrow}
          </span>
          <span style={{ flex: 1, maxWidth: 110, height: 1, background: "var(--color-divider)" }} />
        </div>

        {/* sempre o mesmo título do passo, digitado de novo a cada troca (key) com o traço acompanhando, como no login */}
        <TituloDigitado
          key={passo.id}
          ref={titulo}
          texto={passo.titulo}
          style={{
            margin: "0 0 clamp(8px, 1.5vh, 14px)",
            fontSize: "clamp(28px, 3.4vw, 38px)",
            fontWeight: 400,
            lineHeight: 1.12,
            letterSpacing: "-0.016em",
            textWrap: "balance",
            outline: "none",
          }}
          estiloLinha={{ marginBottom: "clamp(12px, 2vh, 18px)" }}
        />
        <p className="cadastro-texto" style={{ margin: "0 0 clamp(16px, 2.6vh, 24px)", fontSize: 15, lineHeight: 1.65, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
          {passo.texto}
        </p>

        <div className="cadastro-campos" style={{ display: "flex", flexDirection: "column", gap: "clamp(10px, 1.8vh, 16px)" }}>
          {passo.campos.map((campo) => {
            const id = `cadastro-${campo.id}`;
            const valor = valores[campo.id] ?? "";
            const ehSenha = campo.tipo === "password";
            const senhaAtendida = valor.length >= SENHA_MINIMA;
            return (
              <CampoTexto
                key={campo.id}
                ref={(elemento) => {
                  campos.current[campo.id] = elemento;
                }}
                id={id}
                rotulo={campo.rotulo}
                tipo={campo.tipo}
                exemplo={campo.exemplo}
                alternarSenha={ehSenha}
                autoComplete={campo.autoComplete}
                inputMode={campo.inputMode}
                autoCapitalize={campo.autoCapitalize}
                maxLength={campo.maxLength}
                erro={erros[campo.id]}
                tremor={tremorDe(campo.id)}
                ajudaId={ehSenha ? `${id}-requisito` : undefined}
                valor={valor}
                onValor={(novo) => alterar(campo.id, campo.formatar ? campo.formatar(novo) : novo)}
              >
                {/* o requisito da senha fica visível desde o início e marca quando é atendido */}
                {ehSenha && (
                  <p id={`${id}-requisito`} data-testid="requisito-senha" data-atendido={senhaAtendida} className="campo-requisito">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      {senhaAtendida ? <path d="M3.5 8.4l2.9 2.9 6.1-6.6" /> : <circle cx="8" cy="8" r="5.4" />}
                    </svg>
                    Pelo menos {SENHA_MINIMA} caracteres
                    {senhaAtendida && <span className="sr-only"> (atendido)</span>}
                  </p>
                )}
              </CampoTexto>
            );
          })}
        </div>

        <div className="cadastro-acoes" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "clamp(16px, 2.6vh, 24px)" }}>
          {indicePasso > 0 && (
            <button type="button" className="btn btn-ghost" onClick={voltar} disabled={concluindo}>
              Voltar
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={concluindo}
            style={{ flex: 1, fontSize: 15.5, padding: "clamp(10px, 1.6vh, 13px) 22px" }}
          >
            {concluindo ? "Concluindo…" : passo.botao}
          </button>
        </div>

        {/* LGPD: o aceite fica claro antes de a pessoa enviar os dados */}
        {indicePasso === 0 && (
          <p
            className="cadastro-consentimento"
            style={{
              margin: "clamp(10px, 1.8vh, 14px) 0 0",
              fontSize: 13,
              lineHeight: 1.55,
              color: "color-mix(in srgb, var(--color-text) 66%, transparent)",
            }}
          >
            Ao continuar, você aceita os{" "}
            {/* páginas de termos e privacidade ainda não existem */}
            <a href="#" className="login-link-animado">
              Termos
            </a>{" "}
            e a{" "}
            <a href="#" className="login-link-animado">
              Política de privacidade
            </a>
            .
          </p>
        )}

        {/* trilha de progresso: um traço por etapa, dourado até a etapa atual */}
        <ol
          className="cadastro-etapas"
          aria-label="Etapas do cadastro"
          style={{ listStyle: "none", display: "flex", gap: 8, margin: "clamp(16px, 2.6vh, 24px) 0 0", padding: 0 }}
        >
          {PASSOS.map((etapa, indice) => (
            <li
              key={etapa.id}
              aria-current={indice === indicePasso ? "step" : undefined}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 999,
                background: indice <= indicePasso ? "var(--color-accent)" : "var(--color-divider)",
                transition: "background 0.3s ease",
              }}
            >
              <span className="sr-only">
                {etapa.rotuloEtapa}
                {indice < indicePasso ? " (concluída)" : indice === indicePasso ? " (atual)" : ""}
              </span>
            </li>
          ))}
        </ol>

        <p className="cadastro-entrar" style={{ margin: "clamp(14px, 2.4vh, 22px) 0 0", fontSize: 14.5, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
          Já tem conta?{" "}
          <Link href="/login" className="login-link-animado">
            Entrar
          </Link>
        </p>
      </form>

      {/* o mascote acompanha o cadastro pela lateral direita, grande e apagado ao fundo (como no "Como funciona"
          da landing), com a dica por cima; a key troca a imagem a cada passo e repete a entrada */}
      <aside className="cadastro-lado">
        <div key={passo.id} className="cadastro-mascote-fundo" aria-hidden="true">
          <Image
            data-testid="mascote-cadastro"
            className="cadastro-mascote"
            src={passo.mascote.src}
            alt=""
            width={passo.mascote.largura}
            height={passo.mascote.altura}
            sizes="460px"
            {...(indicePasso === 0 ? { preload: true } : { loading: "eager" as const })}
          />
        </div>
        {passo.dicaTitulo && (
          <div key={`dica-${passo.id}`} className="cadastro-dica">
            <div style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>
              {passo.dicaTitulo}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
              {passo.dicaTexto}
            </div>
          </div>
        )}
      </aside>
      </div>
    </MolduraAuth>
  );
}

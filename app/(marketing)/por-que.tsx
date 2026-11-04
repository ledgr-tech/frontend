"use client";

import Image from "next/image";
import Link from "next/link";
import { m, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { LogoBarras } from "@/app/(app)/e/[empresa]/logo-barras";
import { Cena } from "./cena";

// "Por que o Ledgr": as duas saídas que a empresa tem hoje e o Ledgr, cada uma respondendo às
// mesmas perguntas. Por tipo de solução, sem nome de concorrente: a página não tem como sustentar o
// que cada produto faz ou deixa de fazer. Desde 03/11 é uma faixa lateral (como no gsap.com): um
// painel por pergunta, com a resposta do Ledgr grande e as duas saídas de hoje embaixo.
type Motivo = {
  pergunta: string;
  /** a resposta do Ledgr: o que responde à pergunta, e o resto da frase */
  ledgr: [destaque: string, resto: string];
  /** conferir à mão e migrar para um sistema com conciliação */
  hoje: [mao: string, migrar: string];
  /** `sizes` igual ao de outra seção que já mostra o mesmo mascote, para a imagem baixar uma vez só */
  mascote: { src: string; width: number; height: number; sizes?: string };
};

const HOJE = ["Conferir à mão", "Migrar para um sistema com conciliação"] as const;

export const MOTIVOS: Motivo[] = [
  {
    pergunta: "Trocar de sistema",
    ledgr: ["Não precisa.", "Funciona com o sistema que você já usa."],
    hoje: ["Não precisa.", "Precisa. A empresa inteira passa para o sistema novo."],
    mascote: { src: "/mascotes/mascote-laptop.png", width: 824, height: 720 },
  },
  {
    pergunta: "Quem confere, todo mês",
    ledgr: ["O Ledgr, linha por linha.", "Você revisa só o que não bate, já com o motivo."],
    hoje: [
      "Alguém que entenda de contabilidade, linha por linha, com as duas telas abertas.",
      "O sistema novo, depois que tudo estiver nele.",
    ],
    mascote: { src: "/mascotes/mascote-explicando.png", width: 1000, height: 1000, sizes: "(max-width: 760px) 280px, 480px" },
  },
  {
    pergunta: "Para começar",
    ledgr: ["Subir dois arquivos.", "O extrato do banco e o do sistema."],
    hoje: ["A planilha de sempre.", "Migrar cadastros, contas e histórico, e treinar a equipe."],
    mascote: { src: "/mascotes/mascote-arquivo.png", width: 758, height: 720 },
  },
  {
    pergunta: "O que custa",
    ledgr: ["Pelo volume de lançamentos do mês.", "Sem fidelidade nem taxa de implantação."],
    hoje: ["As horas de quem confere, em todo fechamento.", "A mensalidade do sistema novo, mais o trabalho da migração."],
    mascote: { src: "/mascotes/mascote-maleta.png", width: 778, height: 720 },
  },
];

// A onda tem período de 17px: a barra termina num período inteiro, para a curva para baixo sair da ponta.
const PERIODO_DA_ONDA = 17;

/**
 * A seção inteira, porque a faixa precisa medir a própria altura: a seção fica tão alta quanto a
 * faixa é larga, e o miolo fica preso (sticky) enquanto a rolagem empurra os painéis para o lado. Um
 * terço de tela a mais no fim, já com tudo parado, é onde a onda desce em seta para a próxima seção.
 */
export function PorQueOLedgr() {
  const reduzido = useReducedMotion();
  const secao = useRef<HTMLElement>(null);
  const fixo = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const [medidas, setMedidas] = useState<{ distancia: number; extra: number; altura: number; barra: number } | null>(null);

  useLayoutEffect(() => {
    // sem ResizeObserver (navegador antigo, testes) a faixa fica como tira que se arrasta de lado
    if (reduzido || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const caixa = fixo.current;
      const faixa = trilho.current;
      if (!caixa || !faixa) return;
      const distancia = Math.max(0, faixa.scrollWidth - caixa.clientWidth);
      const extra = Math.round(window.innerHeight * 0.35);
      const margem = Math.min(56, Math.max(20, caixa.clientWidth * 0.042));
      const barra = Math.floor((caixa.clientWidth - 2 * margem) / PERIODO_DA_ONDA) * PERIODO_DA_ONDA;
      setMedidas(distancia > 0 ? { distancia, extra, altura: window.innerHeight + distancia + extra, barra } : null);
    };
    medir();
    const observador = new ResizeObserver(medir);
    if (trilho.current) observador.observe(trilho.current);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [reduzido]);

  const { scrollYProgress } = useScroll({ target: secao, offset: ["start start", "end end"] });
  // até onde a rolagem anda a faixa; o resto é a descida da seta
  const ate = medidas ? medidas.distancia / (medidas.distancia + medidas.extra) : 1;
  const andou = useTransform(scrollYProgress, [0, ate], [0, -(medidas?.distancia ?? 0)]);
  const x = useSpring(andou, { stiffness: 220, damping: 40, mass: 0.6 });
  const progresso = useTransform(scrollYProgress, [0, ate], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const desce = ate + (1 - ate) * 0.8;
  const fioDaSeta = useTransform(scrollYProgress, [ate, desce], ["inset(0 0 100% 0)", "inset(0 0 0% 0)"]);
  const ponta = useTransform(scrollYProgress, [desce, 1], [0, 1]);

  const presa = medidas !== null;

  return (
    <section
      id="por-que"
      ref={secao}
      className="onda onda-faixa-clara kin-lat"
      data-presa={presa ? "" : undefined}
      style={presa ? { height: medidas.altura } : undefined}
      aria-labelledby="por-que-titulo"
    >
      <div className="kin-lat-fixo" ref={fixo}>
        <m.div className="kin-lat-trilho" ref={trilho} style={presa ? { x } : undefined}>
          <div className="kin-motivo kin-motivo-intro">
            <p className="rotulo-parte rotulo-parte-ledgr" style={{ marginBottom: 18 }}>
              Por que o Ledgr
            </p>
            <h2 id="por-que-titulo" className="titulo-misto kin-lat-titulo">
              Sem trocar de sistema, <em>e sem voltar para o manual.</em>
            </h2>
            <p className="kin-lat-dica" aria-hidden="true">
              Role para ver os motivos <span>→</span>
            </p>
          </div>
          {MOTIVOS.map((motivo, i) => (
            <Cena key={motivo.pergunta} as="article" className="kin-motivo" margem="0px -25% 0px 0px">
              <div>
                <p className="kin-motivo-num" aria-hidden="true">
                  0{i + 1}
                </p>
                <h3 className="kin-motivo-pergunta">{motivo.pergunta}</h3>
                <p className="kin-motivo-ledgr">
                  {/* o espaço fica fora da palavra: no começo de um inline-block o navegador o descarta, e
                      as palavras grudavam ("Nãoprecisa.") */}
                  {motivo.ledgr[0].split(" ").map((palavra, p) => (
                    <Fragment key={p}>
                      {p > 0 && " "}
                      <span className="kin-pal">{palavra}</span>
                    </Fragment>
                  ))}
                </p>
                <p className="kin-motivo-detalhe">{motivo.ledgr[1]}</p>
                <div className="kin-motivo-hoje">
                  <p className="kin-hoje-rotulo">Hoje</p>
                  <dl>
                    {HOJE.map((saida, j) => (
                      <div key={saida}>
                        <dt>{saida}</dt>
                        <dd>{motivo.hoje[j]}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
              <Image
                src={motivo.mascote.src}
                alt=""
                width={motivo.mascote.width}
                height={motivo.mascote.height}
                sizes={motivo.mascote.sizes ?? "250px"}
                className="kin-motivo-mascote"
              />
            </Cena>
          ))}
          <div className="kin-motivo kin-motivo-fim">
            <LogoBarras className="kin-fim-logo" />
            <p className="kin-fim-frase">
              Dois arquivos por mês. <em>O resto fica com o Ledgr.</em>
            </p>
            <Link href="/cadastro" className="btn btn-primary" style={{ fontSize: 15.5, padding: "13px 24px" }}>
              Começar agora
            </Link>
          </div>
        </m.div>
        {presa && (
          <div className="kin-lat-barra" aria-hidden="true" style={{ width: medidas.barra }}>
            <span className="kin-lat-trilha" />
            <m.span className="kin-lat-progresso" style={{ clipPath: progresso }} />
            <span className="kin-lat-seta">
              <m.span className="kin-lat-seta-fio" style={{ clipPath: fioDaSeta }} />
              <m.svg className="kin-lat-seta-ponta" viewBox="0 0 16 10" style={{ opacity: ponta }}>
                <path d="M2 2l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </m.svg>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  m,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Fragment, useRef, type CSSProperties, type ReactNode } from "react";
import { Cena } from "./cena";
import type { LinhaExtrato } from "./comparacao";
import { Vitrine } from "./vitrine";

// A curva de sempre do guia (os adesivos usam uma mola, no próprio componente).
const SUAVE = [0.22, 1, 0.36, 1] as const;

const LINHA_1 = "Pare de conciliar";
const LINHA_2 = "extrato";
const DESTAQUE = "à mão.";
const TITULO = `${LINHA_1} ${LINHA_2} ${DESTAQUE}`;

// O título entra letra por letra; o resto espera ele terminar, para não chegar tudo junto
// (o colega achou o primeiro corte "carregando muita coisa ao mesmo tempo").
const PASSO_DA_LETRA = 0.024;
const LETRAS = (LINHA_1 + LINHA_2 + DESTAQUE).replaceAll(" ", "").length;
// as letras começam logo depois do rótulo "Cap. I": a página real já gasta um tempo montando o React,
// então o atraso do protótipo (0,45 s) deixava o título vazio no começo
const INICIO_DAS_LETRAS = 0.2;
const FIM_DO_TITULO = INICIO_DAS_LETRAS + LETRAS * PASSO_DA_LETRA + 0.6;

/** Giro de cada letra na entrada, entre -10° e 10°: fixo por posição, para o servidor e o navegador baterem. */
const giro = (n: number) => ((n * 37) % 21) - 10;

/** As letras de um trecho, cada uma subindo da linha de base. `inicio` é a posição da primeira no título. */
function Letras({ texto, inicio }: { texto: string; inicio: number }) {
  let n = inicio;
  return texto.split(" ").map((palavra, p) => (
    <Fragment key={palavra + p}>
      {p > 0 && " "}
      <span className="kin-palavra">
        {[...palavra].map((letra, i) => {
          const posicao = n++;
          return (
            <m.span
              key={i}
              className="kin-l"
              data-reveal
              initial={{ opacity: 0, y: "110%", rotate: giro(posicao) }}
              animate={{ opacity: 1, y: "0%", rotate: 0 }}
              transition={{ duration: 0.8, delay: INICIO_DAS_LETRAS + posicao * PASSO_DA_LETRA, ease: [0.34, 1.3, 0.64, 1] }}
            >
              {letra}
            </m.span>
          );
        })}
      </span>
    </Fragment>
  ));
}

/**
 * Um adesivo de status ao lado do título, como no protótipo (e no gsap.com): entra estalando, depois
 * flutua e segue o mouse e a rolagem, cada um numa profundidade. Três camadas, para nenhum movimento
 * brigar com outro: a posição (mouse e rolagem), a flutuação (CSS) e o adesivo em si, que entra inteiro
 * (fundo, borda e texto juntos; com o fundo na camada de fora, a caixa aparecia vazia antes do texto).
 */
function Adesivo({
  classe,
  posicao,
  inclinacao,
  velocidade,
  profundidade,
  mouse,
  rolagem,
  atraso,
  children,
}: {
  classe: string;
  posicao: CSSProperties;
  inclinacao: number;
  /** quanto ele sobe na rolagem, em alturas dele */
  velocidade: number;
  /** quanto ele segue o mouse */
  profundidade: number;
  mouse: MotionValue<number>;
  rolagem: MotionValue<number>;
  atraso: number;
  children: ReactNode;
}) {
  const reduzido = useReducedMotion();
  const x = useSpring(useTransform(mouse, (v) => v * 36 * profundidade), { stiffness: 80, damping: 18 });
  const y = useTransform(rolagem, [0, 1], ["0%", `${-120 * velocidade}%`]);
  return (
    <m.span className="kin-adesivo-lugar" aria-hidden="true" style={{ ...posicao, ...(reduzido ? {} : { x, y }) }}>
      <span className="kin-flutua">
        <m.span
          className={`kin-adesivo ${classe}`}
          data-reveal
          initial={{ opacity: 0, scale: 0, rotate: inclinacao + (inclinacao > 0 ? -30 : 30) }}
          animate={{ opacity: 1, scale: 1, rotate: inclinacao }}
          transition={{ type: "spring", bounce: 0.55, duration: 0.9, delay: atraso }}
        >
          {children}
        </m.span>
      </span>
    </m.span>
  );
}

/** Um bloco da faixa de baixo (o texto, o botão), subindo depois do título. */
function Sobe({ atraso, children }: { atraso: number; children: ReactNode }) {
  return (
    <m.div data-reveal initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: atraso, ease: SUAVE }}>
      {children}
    </m.div>
  );
}

/**
 * O hero da landing (artefato "Landing Ledgr animada", 03/11): o título grande letra por letra, o
 * "à mão." sublinhado em dourado com o adesivo "O Ledgr confere por você." e dois adesivos de status.
 * Embaixo, a "Comparação direta" numa janela, que se endireita conforme entra na tela.
 */
export function Hero({ banco, sistema }: { banco: LinhaExtrato[]; sistema: LinhaExtrato[] }) {
  const reduzido = useReducedMotion();
  const topo = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const mouse = useMotionValue(0);

  const { scrollYProgress: rolagem } = useScroll({ target: topo, offset: ["start start", "end start"] });
  const abreLinha1 = useTransform(rolagem, [0, 0.45], ["0%", "-6%"]);
  const abreLinha2 = useTransform(rolagem, [0, 0.45], ["0%", "5%"]);

  const { scrollYProgress: chegada } = useScroll({ target: palco, offset: ["start end", "start 0.22"] });
  // endireitada, a janela fica sem transformação nenhuma: um rotateX(0) com perspective continuaria
  // uma camada 3D e faria o navegador reorganizar as camadas da página inteira a cada quadro
  const janela = useTransform(chegada, (v) =>
    v >= 1 ? "none" : `perspective(1800px) rotateX(${34 * (1 - v)}deg) scale(${0.84 + 0.16 * v})`,
  );
  const surgeJanela = useTransform(chegada, [0, 1], [0.35, 1]);

  return (
    <div className="kin-hero">
      <div
        className="kin-topo"
        ref={topo}
        onPointerMove={(evento) => {
          const caixa = evento.currentTarget.getBoundingClientRect();
          mouse.set((evento.clientX - caixa.left) / caixa.width - 0.5);
        }}
      >
        <m.p className="eyebrow kin-olho" data-reveal initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: SUAVE }}>
          Cap. I · O fechamento do mês
        </m.p>
        <h1 className="kin-titulo">
          <span className="sr-only">{TITULO}</span>
          <m.span className="kin-linha" aria-hidden="true" style={reduzido ? undefined : { x: abreLinha1 }}>
            <Letras texto={LINHA_1} inicio={0} />
          </m.span>
          <m.span className="kin-linha" aria-hidden="true" style={reduzido ? undefined : { x: abreLinha2 }}>
            <Letras texto={LINHA_2} inicio={LINHA_1.replaceAll(" ", "").length} />{" "}
            <span className="kin-mao">
              <em>
                <Letras texto={DESTAQUE} inicio={(LINHA_1 + LINHA_2).replaceAll(" ", "").length} />
              </em>
              {/* sublinhado, e não risco: riscado, o título lia "Pare de conciliar extrato com o Ledgr" */}
              <m.span
                className="kin-sublinhado"
                data-reveal
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, delay: FIM_DO_TITULO + 0.75, ease: [0.65, 0, 0.35, 1] }}
              />
              <m.span
                className="kin-adesivo kin-adesivo-tinta"
                style={{ rotate: -6 }}
                data-reveal
                initial={{ opacity: 0, scale: 2.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, delay: FIM_DO_TITULO + 1.15, ease: [0.34, 2, 0.64, 1] }}
              >
                O Ledgr confere por você.
              </m.span>
            </span>
          </m.span>
        </h1>
        <Adesivo
          classe="kin-adesivo-ok"
          posicao={{ top: "calc(34px + 1.08 * var(--t))", right: "1%" }}
          inclinacao={6}
          velocidade={0.5}
          profundidade={1.2}
          mouse={mouse}
          rolagem={rolagem}
          atraso={FIM_DO_TITULO + 0.35}
        >
          <Check size="0.9em" strokeWidth={3} aria-hidden="true" />
          Conciliado
        </Adesivo>
        <Adesivo
          classe="kin-adesivo-risco"
          posicao={{ top: "calc(34px + 1.42 * var(--t))", right: "9%" }}
          inclinacao={-7}
          velocidade={0.9}
          profundidade={2}
          mouse={mouse}
          rolagem={rolagem}
          atraso={FIM_DO_TITULO + 0.49}
        >
          Valor diverge
        </Adesivo>
        <div className="kin-base">
          <Sobe atraso={FIM_DO_TITULO + 1.45}>
            <p className="kin-texto">
              Continue no sistema de gestão que você já usa. Suba o extrato do banco e o do sistema: em minutos o Ledgr
              confere linha por linha e aponta só o que não bate, com o motivo de cada diferença.
            </p>
          </Sobe>
          <Sobe atraso={FIM_DO_TITULO + 1.55}>
            <Link href="/cadastro" className="btn btn-primary" style={{ fontSize: 15.5, padding: "14px 26px" }}>
              Começar agora
            </Link>
          </Sobe>
        </div>
      </div>
      <div ref={palco}>
        <Cena className="kin-palco" margem="0px 0px -45% 0px">
          <m.div
            data-reveal
            style={reduzido ? undefined : { transform: janela, opacity: surgeJanela }}
          >
            <Vitrine banco={banco} sistema={sistema} destaque="Pagamento fornecedor #1082" compacta />
          </m.div>
        </Cena>
      </div>
    </div>
  );
}

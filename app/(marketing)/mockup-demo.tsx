"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { m, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { LogoBarras } from "@/app/(app)/e/[empresa]/logo-barras";
import { MenuDaVitrine } from "./vitrine";

/**
 * O vídeo do produto refeito em HTML: as mesmas telas da gravação (Nova conciliação, a comparação, a
 * justificativa, Fechamentos), só que como as telas de verdade do app, nítidas em qualquer tamanho,
 * com o cursor, a digitação e uma abertura. As telas vêm de `./cenas` (capturadas do app com a conta
 * de teste; HTML estático, sem script) e entram na moldura da vitrine (`vitrine-*`).
 *
 * O roteiro (`rodar`) só anda enquanto a janela está na tela. Com movimento reduzido não anda: fica a
 * comparação com o cartão da linha aberto.
 *
 * shortcut: as telas são cópias do app de 04/11/2026; se o desenho do app mudar, capturar de novo.
 */

const LARGURA = 1280;
const ALTURA = 800;
const MENU_ATIVO = { conciliacoes: "Conciliações", fechamentos: "Fechamentos" } as const;

type Cenas = typeof import("./cenas");
type Cena = "novaVazia" | "novaBanco" | "novaPronta" | "comparando" | "comparacao" | "comparacaoJustificada" | "fechamentos";

class Interrompido extends Error {}

function dorme(ms: number, sinal: AbortSignal) {
  return new Promise<void>((ok, nao) => {
    if (sinal.aborted) return nao(new Interrompido());
    const t = window.setTimeout(ok, ms);
    sinal.addEventListener("abort", () => (window.clearTimeout(t), nao(new Interrompido())), { once: true });
  });
}

const achaPorTexto = (raiz: ParentNode | null, seletor: string, texto: RegExp) =>
  [...(raiz?.querySelectorAll<HTMLElement>(seletor) ?? [])].find((e) => texto.test(e.textContent ?? "")) ?? null;
const achaLinha = (raiz: ParentNode | null, data: string, inicio: string) =>
  [...(raiz?.querySelectorAll<HTMLElement>("tbody tr") ?? [])].find((tr) => (tr.textContent ?? "").includes(data) && (tr.textContent ?? "").includes(inicio)) ?? null;

export function MockupDemo({ descricao }: { descricao: string }) {
  const palco = useRef<HTMLElement>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<HTMLDivElement>(null);
  const veuRef = useRef<HTMLDivElement>(null);
  const reduzido = useReducedMotion();
  const perto = useInView(palco, { margin: "600px 0px", once: true });
  const naTela = useInView(quadro, { amount: 0.4 });

  const [cenas, setCenas] = useState<Cenas | null>(null);
  const [escala, setEscala] = useState<number | null>(null);
  const escalaRef = useRef(1);

  const [cena, setCena] = useState<Cena>("comparacao");
  const [menu, setMenu] = useState<string>(MENU_ATIVO.conciliacoes);
  const [intro, setIntro] = useState(false);
  const [rolagem, setRolagem] = useState(0);
  const [hover, setHover] = useState(true);
  const [janela, setJanela] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [cursor, setCursor] = useState<{ x: number; y: number; visivel: boolean; clique: number }>({ x: 640, y: 420, visivel: false, clique: 0 });

  // as cenas pesam ~140 KB: só baixam quando a janela chega perto da tela
  useEffect(() => {
    if (perto) void import("./cenas").then(setCenas);
  }, [perto]);

  // a janela de 1280 px encolhe inteira para caber (transform, e não zoom: a posição do cursor se mede)
  useLayoutEffect(() => {
    const elemento = quadro.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const medir = (largura: number) => {
      if (largura <= 0) return;
      escalaRef.current = largura / LARGURA;
      setEscala(largura / LARGURA);
    };
    medir(elemento.clientWidth);
    const observador = new ResizeObserver(([entrada]) => medir(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  // o cartão do hover, aberto sobre a linha como no app
  useEffect(() => {
    const raiz = cenaRef.current;
    if (!raiz || !cenas || cena !== "comparacao" || !hover) return;
    const linha = achaLinha(raiz, "09/07", "PIX ENVIA");
    const celula = linha?.querySelector<HTMLElement>(".celula-status");
    if (!linha || !celula) return;
    linha.setAttribute("data-destacada", "");
    celula.insertAdjacentHTML("beforeend", cenas.cartaoDoHover);
    return () => {
      linha.removeAttribute("data-destacada");
      celula.querySelector(".cartao-lancamento")?.remove();
    };
  }, [cenas, cena, hover]);

  const rodar = useCallback(
    async (c: Cenas, sinal: AbortSignal) => {
      const posicao = (alvo: HTMLElement | null, dx = 0.35) => {
        const o = app.current?.getBoundingClientRect();
        if (!alvo || !o) return null;
        const r = alvo.getBoundingClientRect();
        const s = escalaRef.current;
        return { x: (r.left - o.left + r.width * dx) / s, y: (r.top - o.top + r.height / 2) / s };
      };
      const mover = async (alvo: HTMLElement | null, dx?: number) => {
        const p = posicao(alvo, dx);
        if (p) setCursor((a) => ({ ...a, ...p, visivel: true }));
        await dorme(1000, sinal);
      };
      const clicar = async () => {
        setCursor((a) => ({ ...a, clique: a.clique + 1 }));
        await dorme(380, sinal);
      };
      const cenaAtual = () => cenaRef.current;

      try {
        for (;;) {
          // abertura
          setCursor((a) => ({ ...a, visivel: false }));
          setJanela(false);
          setHover(false);
          setRolagem(0);
          setDigitado("");
          setMenu(MENU_ATIVO.conciliacoes);
          setCena("novaVazia");
          setIntro(true);
          await dorme(3600, sinal);
          setIntro(false);
          await dorme(900, sinal);

          // Nova conciliação: os dois extratos e "Conciliar extratos"
          await mover(cenaAtual()?.querySelector<HTMLElement>(".nova-folha-banco") ?? null);
          await clicar();
          setCena("novaBanco");
          await dorme(1100, sinal);
          await mover(cenaAtual()?.querySelector<HTMLElement>(".nova-folha-sistema") ?? null);
          await clicar();
          setCena("novaPronta");
          await dorme(1300, sinal);
          await mover(achaPorTexto(cenaAtual(), "button", /Conciliar extratos/));
          await clicar();
          setCena("comparando");
          setCursor((a) => ({ ...a, visivel: false }));
          await dorme(2800, sinal);

          // a comparação: o resumo, depois a tabela, e o cartão de uma linha
          setCena("comparacao");
          await dorme(2200, sinal);
          setRolagem(330);
          await dorme(1400, sinal);
          await mover(achaLinha(cenaAtual(), "09/07", "PIX ENVIA")?.querySelector<HTMLElement>(".celula-status") ?? null);
          setHover(true);
          await dorme(2800, sinal);
          setHover(false);

          // justificar uma divergência
          await mover(achaLinha(cenaAtual(), "06/07", "BOLETO F"));
          await clicar();
          setJanela(true);
          await dorme(900, sinal);
          for (let i = 1; i <= c.TEXTO_DA_JUSTIFICATIVA.length; i++) {
            setDigitado(c.TEXTO_DA_JUSTIFICATIVA.slice(0, i));
            await dorme(38, sinal);
          }
          await dorme(700, sinal);
          await mover(achaPorTexto(veuRef.current, "button", /^Justificar$/));
          await clicar();
          setJanela(false);
          setCena("comparacaoJustificada");
          setRolagem(0);
          await dorme(2600, sinal);

          // o mês em Fechamentos
          await mover(achaPorTexto(app.current, ".vitrine-item", /Fechamentos/), 0.4);
          await clicar();
          setMenu(MENU_ATIVO.fechamentos);
          setCena("fechamentos");
          setCursor((a) => ({ ...a, visivel: false }));
          await dorme(4200, sinal);
        }
      } catch (erro) {
        if (!(erro instanceof Interrompido)) throw erro;
      }
    },
    [],
  );

  useEffect(() => {
    if (!cenas || !naTela || reduzido || !escala) return;
    const controle = new AbortController();
    // fora do corpo do efeito: o roteiro escreve estado a cada passo
    const partida = window.setTimeout(() => void rodar(cenas, controle.signal), 0);
    return () => {
      window.clearTimeout(partida);
      controle.abort();
    };
  }, [cenas, naTela, reduzido, escala, rodar]);

  // a janela endireita conforme entra na tela, como a do vídeo
  const { scrollYProgress } = useScroll({ target: palco, offset: ["start end", "start 0.3"] });
  const inclinada = useTransform(scrollYProgress, (v) =>
    v >= 1 ? "none" : `perspective(1600px) translateY(${70 * (1 - v)}px) rotateX(${20 * (1 - v)}deg) scale(${0.86 + 0.14 * v})`,
  );

  const html = cenas?.[cena];
  const modal = cenas?.janelaDeJustificativa.replace("{{TEXTO}}", digitado);

  return (
    <figure className="vitrine video-demo mockup-demo" ref={palco} data-medida={escala ? "" : undefined}>
      <m.div data-reveal style={reduzido ? undefined : { transform: inclinada }}>
        <div className="vitrine-janela">
          <div className="vitrine-barra" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="mockup-quadro" ref={quadro} role="img" aria-label={descricao}>
            <div
              className="vitrine-app mockup-app"
              ref={app}
              inert
              style={{ transform: `scale(${escala ?? 1})`, height: ALTURA }}
            >
              <MenuDaVitrine ativo={menu} empresa="Empresa de Teste Ltda" conta="Teste" iniciais="TE" />
              <div className="vitrine-principal mockup-principal">
                {cenas && <div dangerouslySetInnerHTML={{ __html: cenas.barraDeCima }} />}
                <div className="mockup-visor">
                  {html && (
                    <div
                      key={cena}
                      ref={cenaRef}
                      className="mockup-cena"
                      style={{ transform: `translateY(${-rolagem}px)` }}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  )}
                </div>
              </div>

              <div className="mockup-veu" data-aberto={janela || undefined} ref={veuRef}>
                {modal && <div dangerouslySetInnerHTML={{ __html: modal }} />}
              </div>

              <svg
                className="mockup-cursor"
                data-visivel={cursor.visivel || undefined}
                style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
                width="22"
                height="26"
                viewBox="0 0 22 26"
                aria-hidden="true"
              >
                <path d="M2 2 2 21l5.2-4.6 3.6 7.6 3.4-1.6-3.6-7.4H18z" fill="#fff" stroke="#201f1d" strokeWidth="1.6" strokeLinejoin="round" />
                <circle key={cursor.clique} className="mockup-clique" cx="2" cy="2" r="14" />
              </svg>
            </div>

            <div className="mockup-intro" data-aberta={(intro || !cenas) && !reduzido ? "" : undefined} aria-hidden="true">
              <LogoBarras className="mockup-intro-logo" />
              <p className="titulo-misto mockup-intro-titulo">
                Do extrato ao <em>fechamento do mês.</em>
              </p>
              <p className="mockup-intro-sub">Um mês conciliado, passo a passo</p>
            </div>
          </div>
        </div>
      </m.div>
      <figcaption className="video-demo-legenda">As telas do Ledgr, com dados de teste · animação de cerca de 40 segundos</figcaption>
    </figure>
  );
}

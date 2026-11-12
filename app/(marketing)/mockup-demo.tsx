"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { m, useInView, useScroll, useTransform } from "motion/react";
import { LogoBarras } from "@/app/(app)/e/[empresa]/logo-barras";
import { useMovimentoReduzido } from "@/app/reveal";

/**
 * O vídeo do produto refeito em HTML: a Nova conciliação, a comparação com o painel da direita, a justificativa
 * escrita no painel e Fechamentos, como as telas de verdade do app, nítidas em qualquer tamanho, com o cursor, a
 * digitação e uma abertura. Só as telas, numa janela do Mac, sem o menu lateral e a barra de cima do app: o nome
 * da tela vai na barra da janela, como em "Na prática". As telas vêm de `./cenas`, gravadas do app por
 * `scripts/ajuda-videos/gravar.mjs --landing` (HTML estático, sem script), com o que o cursor procura marcado
 * em data-mockup.
 *
 * O roteiro (`rodar`) só anda enquanto a janela está na tela. Com movimento reduzido não anda: fica a
 * comparação com a linha aberta no painel.
 *
 * ponytail: as telas são cópias do app; se o desenho dele mudar, grave de novo (gravar.mjs --landing).
 */

const LARGURA = 1280;
// a altura das telas gravadas (MOCKUP em gravar.mjs): a Nova conciliação cabe inteira
const ALTURA = 860;

type Cenas = typeof import("./cenas");
type Cena =
  | "novaVazia"
  | "novaBanco"
  | "novaPronta"
  | "comparando"
  | "comparacao"
  | "comparacaoFoco"
  | "justificando"
  | "comparacaoJustificada"
  | "fechamentos";

// o nome da tela na barra da janela, no lugar do menu e da barra de cima do app
const TITULO: Record<Cena, string> = {
  novaVazia: "Nova conciliação",
  novaBanco: "Nova conciliação",
  novaPronta: "Nova conciliação",
  comparando: "Nova conciliação",
  comparacao: "Comparação direta",
  comparacaoFoco: "Comparação direta",
  justificando: "Comparação direta",
  comparacaoJustificada: "Comparação direta",
  fechamentos: "Fechamentos",
};

class Interrompido extends Error {}

function dorme(ms: number, sinal: AbortSignal) {
  return new Promise<void>((ok, nao) => {
    if (sinal.aborted) return nao(new Interrompido());
    const t = window.setTimeout(ok, ms);
    sinal.addEventListener("abort", () => (window.clearTimeout(t), nao(new Interrompido())), { once: true });
  });
}

export function MockupDemo({ descricao }: { descricao: string }) {
  const palco = useRef<HTMLElement>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const cenaRef = useRef<HTMLDivElement>(null);
  const reduzido = useMovimentoReduzido();
  const perto = useInView(palco, { margin: "600px 0px", once: true });
  const naTela = useInView(quadro, { amount: 0.4 });

  const [cenas, setCenas] = useState<Cenas | null>(null);
  const [escala, setEscala] = useState<number | null>(null);
  const escalaRef = useRef(1);

  const [cena, setCena] = useState<Cena>("comparacaoFoco");
  const [intro, setIntro] = useState(false);
  const [fim, setFim] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [cursor, setCursor] = useState<{ x: number; y: number; visivel: boolean; clique: number }>({ x: 640, y: 420, visivel: false, clique: 0 });
  const cenaVisivel = reduzido ? "comparacaoFoco" : cena;

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

  const rodar = useCallback(async (c: Cenas, sinal: AbortSignal) => {
    const posicao = (alvo: HTMLElement | null, dx = 0.35) => {
      const o = app.current?.getBoundingClientRect();
      if (!alvo || !o) return null;
      const r = alvo.getBoundingClientRect();
      const s = escalaRef.current;
      return { x: (r.left - o.left + r.width * dx) / s, y: (r.top - o.top + r.height / 2) / s };
    };
    // o que o cursor procura vem marcado na gravação (data-mockup)
    const alvo = (nome: string) => cenaRef.current?.querySelector<HTMLElement>(`[data-mockup="${nome}"]`) ?? null;
    const mover = async (nome: string) => {
      const p = posicao(alvo(nome));
      if (p) setCursor((a) => ({ ...a, ...p, visivel: true }));
      await dorme(1000, sinal);
    };
    const clicar = async () => {
      setCursor((a) => ({ ...a, clique: a.clique + 1 }));
      await dorme(380, sinal);
    };
    const esconder = () => setCursor((a) => ({ ...a, visivel: false }));

    try {
      for (;;) {
        // abertura
        esconder();
        setDigitado("");
        setCena("novaVazia");
        setFim(false);
        setIntro(true);
        await dorme(3600, sinal);
        setIntro(false);
        await dorme(900, sinal);

        // Nova conciliação: os dois extratos e "Conciliar extratos"
        await mover("banco");
        await clicar();
        setCena("novaBanco");
        await dorme(1100, sinal);
        await mover("sistema");
        await clicar();
        setCena("novaPronta");
        await dorme(1300, sinal);
        await mover("conciliar");
        await clicar();
        setCena("comparando");
        esconder();
        await dorme(2800, sinal);

        // a comparação: o clique numa linha que diverge leva o detalhe e o motivo ao painel da direita
        setCena("comparacao");
        await dorme(2000, sinal);
        await mover("linha");
        await clicar();
        setCena("comparacaoFoco");
        await dorme(3600, sinal);

        // justificar no próprio painel
        await mover("justificar");
        await clicar();
        setCena("justificando");
        await dorme(700, sinal);
        for (let i = 1; i <= c.TEXTO_DA_JUSTIFICATIVA.length; i++) {
          setDigitado(c.TEXTO_DA_JUSTIFICATIVA.slice(0, i));
          await dorme(38, sinal);
        }
        await dorme(700, sinal);
        await mover("enviar");
        await clicar();
        setCena("comparacaoJustificada");
        await dorme(2800, sinal);

        // o mês em Fechamentos
        esconder();
        setCena("fechamentos");
        await dorme(4400, sinal);

        // o encerramento: rápido, simples e prático
        setFim(true);
        await dorme(6200, sinal);
        setFim(false);
        await dorme(900, sinal);
      }
    } catch (erro) {
      if (!(erro instanceof Interrompido)) throw erro;
    }
  }, []);

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

  // a justificativa aparece letra a letra no campo que a gravação marcou: só o valor muda. Trocar o HTML a cada letra
  // refaria a tela, e a entrada do painel (comp-foco-entra) recomeçaria a cada uma, deixando-o apagado
  const html = cenaVisivel === "justificando" ? cenas?.justificando.replace("{{TEXTO}}", "") : cenas?.[cenaVisivel];
  useLayoutEffect(() => {
    const campo = cenaRef.current?.querySelector("textarea");
    if (campo) campo.value = digitado;
  }, [digitado]);

  return (
    <figure className="vitrine video-demo mockup-demo" ref={palco} data-medida={escala ? "" : undefined}>
      <m.div data-reveal style={reduzido ? undefined : { transform: inclinada }}>
        <div className="vitrine-janela">
          <div className="vitrine-barra" aria-hidden="true">
            <span />
            <span />
            <span />
            <p className="janela-titulo">{TITULO[cenaVisivel]}</p>
          </div>
          <div className="mockup-quadro" ref={quadro} role="img" aria-label={descricao}>
            <div
              className="vitrine-app mockup-app"
              ref={app}
              inert
              style={{ transform: `scale(${escala ?? 1})`, height: ALTURA }}
            >
              <div className="vitrine-principal mockup-principal">
                <div className="mockup-visor">
                  {html && (
                    // a chave é a tela, não a cena: trocar de tela entra com o fade; dentro da mesma tela só muda o
                    // que mudou (o painel, a linha), como no app
                    <div
                      key={TITULO[cenaVisivel]}
                      data-cena={cenaVisivel}
                      ref={cenaRef}
                      className="mockup-cena"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  )}
                </div>
              </div>

              <svg
                className="mockup-cursor"
                data-visivel={cursor.visivel && !reduzido ? "" : undefined}
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

            <div className="mockup-intro" data-aberta={intro || !cenas ? "" : undefined} aria-hidden="true">
              <LogoBarras className="mockup-intro-logo" />
              <p className="titulo-misto mockup-intro-titulo">
                Do extrato ao <em>fechamento do mês.</em>
              </p>
              <p className="mockup-intro-sub">Um mês conciliado, passo a passo</p>
            </div>

            <div className="mockup-intro mockup-fim" data-aberta={fim && !reduzido ? "" : undefined} aria-hidden="true">
              <LogoBarras className="mockup-intro-logo" />
              <p className="titulo-misto mockup-intro-titulo">
                Rápido, simples e <em>prático.</em>
              </p>
              <ol className="mockup-fim-passos">
                {["Envie os dois extratos", "Confira e aponte", "Feche o mês"].map((passo, i) => (
                  <li key={passo} style={{ "--i": i } as CSSProperties}>
                    <span>{i + 1}</span>
                    {passo}
                  </li>
                ))}
              </ol>
              <p className="mockup-intro-sub">Em minutos, o Ledgr confere linha por linha · 14 dias grátis, sem cartão</p>
            </div>
          </div>
        </div>
      </m.div>
      <figcaption className="video-demo-legenda">As telas do Ledgr, com dados de teste · animação de cerca de 40 segundos</figcaption>
    </figure>
  );
}

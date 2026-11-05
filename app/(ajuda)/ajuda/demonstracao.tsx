"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import { useInView, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { MenuDaVitrine } from "@/app/(marketing)/vitrine";
import { Texto } from "./blocos";
import type { ImagemDaAjuda } from "./paginas";

/**
 * A tela do app tocando em HTML, no lugar do vídeo (que borrava: a tela de 1360 px cabia em 680). As
 * cenas são o conteúdo do app capturado a cada passo por `gravar.mjs`, com o alvo de cada passo
 * marcado (data-passo), dentro da moldura da vitrine da landing. A câmera chega perto do que a legenda
 * fala, e o texto continua nítido porque é HTML; as cores seguem o tema da Central.
 *
 * ponytail: as cenas são cópias do app; se o desenho de uma tela mudar, rodar o gravador de novo.
 */

const LARGURA = 1280;
const ALTURA = 800;
/** até onde a câmera chega perto: o texto de 14 px, que na coluna de 680 fica com 7, vai a 12 */
const ZOOM_MAXIMO = 1.7;

export type PassoDaDemonstracao = {
  /** ms desde o começo da captura: o player toca no ritmo do gravador */
  t: number;
  cena: number;
  menu?: string;
  n?: string;
  texto?: string;
  detalhe?: string;
  /** o data-passo do que a legenda destaca, ou "menu:<nome>" para um item do menu lateral */
  foco?: number | string;
  /** o data-passo onde o cursor clica, ou "menu:<nome>" */
  cursor?: number | string;
  clique?: number;
};

export type DadosDaDemonstracao = {
  barra: string;
  conta: { nome?: string; empresa?: string; iniciais?: string };
  cenas: string[];
  /** o que o app põe por cima da página em cada cena: as janelas abertas e o painel da linha */
  camadas?: string[];
  passos: PassoDaDemonstracao[];
  fim: number;
};

/** em px do app; na cena, y conta do topo dela (que rola), e fora dela, do topo do app */
type Caixa = { x: number; y: number; w: number; h: number; naCena?: boolean };

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

// cada arquivo é buscado uma vez: as figuras de uma página dividem o mesmo (uma falha tenta de novo na próxima vez)
const arquivos = new Map<string, Promise<unknown>>();
function useArquivo<T>(src: string): T | null {
  const [lido, setLido] = useState<{ src: string; dados: T | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!arquivos.has(src))
      arquivos.set(
        src,
        fetch(src)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .then((dados) => {
            if (!dados) arquivos.delete(src);
            return dados;
          }),
      );
    void arquivos.get(src)!.then((dados) => vivo && setLido({ src, dados: dados as T | null }));
    return () => {
      vivo = false;
    };
  }, [src]);
  return lido?.src === src ? lido.dados : null;
}

export function Demonstracao({ src, titulo, capa }: { src: string; titulo: string; capa: ImagemDaAjuda }) {
  const raiz = useRef<HTMLDivElement>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const visor = useRef<HTMLDivElement>(null);
  const cena = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);
  const anel = useRef<HTMLDivElement>(null);
  const seta = useRef<SVGSVGElement>(null);
  const onda = useRef<SVGCircleElement>(null);
  const rolagem = useRef(0);
  const reduzido = useReducedMotion();
  const naTela = useInView(raiz, { amount: 0.3 });

  const dados = useArquivo<DadosDaDemonstracao>(src);
  const [i, setI] = useState(0);
  const [tocar, setTocar] = useState<boolean | null>(null);
  const tocando = Boolean(dados) && (tocar ?? !reduzido) && naTela;

  // cada passo dura até o próximo começar, como no gravador; o último segura um pouco antes de recomeçar
  useEffect(() => {
    if (!tocando || !dados) return;
    const proximo = dados.passos[i + 1];
    const ms = (proximo?.t ?? dados.fim + 1500) - dados.passos[i].t;
    const id = window.setTimeout(() => setI((j) => (j + 1) % dados.passos.length), Math.max(ms, 300));
    return () => window.clearTimeout(id);
  }, [tocando, dados, i]);

  // posiciona a cena, o destaque, o cursor e a câmera direto no DOM: as medidas saem da cena já montada
  const aplicar = useCallback(
    (comClique: boolean) => {
      const passo = dados?.passos[i];
      const [q, a, v, c] = [quadro.current, app.current, visor.current, cena.current];
      if (!passo || !q || !a || !v || !c) return;
      // a cena nova entra já na rolagem certa e o app já na escala certa; só o que muda depois anda
      for (const e of [a, c]) {
        e.style.transition = e.dataset.vista === undefined ? "none" : "";
        e.dataset.vista = "";
      }
      // a rolagem de dentro das listas e janelas, como estava na captura
      for (const raiz of [c, camada.current])
        for (const e of raiz?.querySelectorAll<HTMLElement>("[data-rolagem]") ?? []) e.scrollTop = Number(e.dataset.rolagem);
      // medidas em px do app (1280 × 800), mesmo no meio de uma transição da câmera
      const ra = a.getBoundingClientRect();
      const k = ra.width / LARGURA || 1;
      const rc = c.getBoundingClientRect();
      const rv = v.getBoundingClientRect();
      const topoDoVisor = (rv.top - ra.top) / k;
      const alturaDoVisor = rv.height / k;
      const caixa = (id?: number | string): Caixa | null => {
        if (id == null) return null;
        const e =
          typeof id === "string"
            ? [...a.querySelectorAll(".vitrine-menu .vitrine-item")].find((x) => id.slice(5).startsWith(x.textContent?.trim() || "\u0000"))
            : a.querySelector(`[data-passo="${id}"]`);
        if (!e) return null;
        const r = e.getBoundingClientRect();
        const naCena = c.contains(e);
        return { x: (r.left - ra.left) / k, y: (r.top - (naCena ? rc.top : ra.top)) / k, w: r.width / k, h: r.height / k, naCena };
      };
      const foco = caixa(passo.foco);
      const alvo = caixa(passo.cursor);

      // a cena rola até o alvo, como a página rolava no vídeo (um alvo numa janela por cima não mexe nela)
      const guia = [alvo, foco].find((b) => b?.naCena);
      if (guia) {
        const desejada = guia.h > alturaDoVisor * 0.85 ? guia.y - 16 : guia.y + guia.h / 2 - alturaDoVisor / 2;
        rolagem.current = entre(desejada, 0, rc.height / k - alturaDoVisor);
      } else if (i === 0) rolagem.current = 0;
      c.style.transform = `translateY(${-rolagem.current}px)`;
      // a parte da caixa que fica à vista, em px do app
      const naJanela = (b: Caixa): Caixa => {
        if (!b.naCena) return b;
        const topo = Math.max(topoDoVisor + b.y - rolagem.current, topoDoVisor + 4);
        const base = Math.min(topoDoVisor + b.y - rolagem.current + b.h, topoDoVisor + alturaDoVisor - 4);
        return { x: b.x, y: topo, w: b.w, h: Math.max(0, base - topo), naCena: true };
      };

      const f = foco && naJanela(foco);
      const mostra = f && f.h > 0 ? f : null;
      if (anel.current) {
        anel.current.style.opacity = mostra ? "1" : "0";
        if (mostra)
          Object.assign(anel.current.style, {
            left: `${mostra.x - 8}px`,
            top: `${mostra.y - 8}px`,
            width: `${mostra.w + 16}px`,
            height: `${mostra.h + 16}px`,
          });
      }

      // a câmera: perto do destaque, ou a tela inteira
      const z = mostra ? entre(Math.min((LARGURA * 0.9) / (mostra.w + 96), (ALTURA * 0.8) / (mostra.h + 96)), 1, ZOOM_MAXIMO) : 1;
      const cx = mostra ? mostra.x + mostra.w / 2 : LARGURA / 2;
      const cy = mostra ? mostra.y + mostra.h / 2 : ALTURA / 2;
      const x = entre(cx - LARGURA / z / 2, 0, LARGURA - LARGURA / z);
      const y = entre(cy - ALTURA / z / 2, 0, ALTURA - ALTURA / z);
      a.style.transform = `scale(${(q.clientWidth / LARGURA) * z}) translate(${-x}px, ${-y}px)`;

      const s = seta.current;
      if (!s) return;
      if (alvo) {
        const b = naJanela(alvo);
        s.setAttribute("data-visivel", "");
        s.style.transform = `translate(${b.x + b.w / 2}px, ${b.y + b.h / 2}px)`;
        // o clique quando o cursor chega (a transição dele dura 1 s)
        if (comClique && !reduzido)
          for (let n = 0; n < (passo.clique ?? 1); n++)
            onda.current?.animate?.(
              [
                { opacity: 0.55, transform: "scale(0.15)" },
                { opacity: 0, transform: "scale(1)" },
              ],
              { duration: 550, delay: 950 + n * 220, easing: "ease-out" },
            );
      } else if (i === 0) s.removeAttribute("data-visivel");
    },
    [dados, i, reduzido],
  );

  useLayoutEffect(() => aplicar(true), [aplicar]);
  useLayoutEffect(() => {
    const q = quadro.current;
    if (!q || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => aplicar(false));
    observador.observe(q);
    return () => observador.disconnect();
  }, [aplicar]);

  // anterior e próximo andam de legenda em legenda, não de clique em clique
  const marcos = useMemo(
    // cada legenda nova é um passo, mesmo quando só o detalhe muda (o Detalhe da linha faz isso no 3)
    () =>
      dados?.passos.flatMap((p, j) => {
        const antes = dados.passos[j - 1];
        return !antes || p.texto !== antes.texto || p.detalhe !== antes.detalhe ? [j] : [];
      }) ?? [],
    [dados],
  );
  const marco = Math.max(0, marcos.findLastIndex((j) => j <= i));
  const irPara = (m: number) => {
    if (marcos.length) setI(marcos[(m + marcos.length) % marcos.length]);
  };
  const passo = dados?.passos[i];

  return (
    <div className="ajd-demo" ref={raiz}>
      <div className="vitrine-janela">
        <div className="vitrine-barra" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="mockup-quadro" ref={quadro} role="img" aria-label={`A tela ${titulo} do Ledgr, com dados de exemplo`}>
          {dados && passo ? (
            <Replica
              dados={dados}
              cena={passo.cena}
              camada={dados.camadas?.[passo.cena]}
              chaveDaCamada={passo.cena}
              menu={passo.menu}
              appRef={app}
              visorRef={visor}
              cenaRef={cena}
              camadaRef={camada}
            >
              <div className="ajd-demo-anel" ref={anel} />
              <svg className="mockup-cursor" ref={seta} width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
                <path d="M2 2 2 21l5.2-4.6 3.6 7.6 3.4-1.6-3.6-7.4H18z" fill="#fff" stroke="#201f1d" strokeWidth="1.6" strokeLinejoin="round" />
                <circle ref={onda} className="mockup-clique" cx="2" cy="2" r="14" />
              </svg>
            </Replica>
          ) : (
            <Image
              src={capa.src}
              width={capa.largura}
              height={capa.altura}
              alt=""
              className="ajd-demo-capa"
              sizes="(max-width: 820px) 100vw, 680px"
              priority
            />
          )}
        </div>
      </div>

      <div className="ajd-demo-rodape">
        <p className="ajd-demo-legenda">
          {passo?.n ? <span className="ajd-demo-numero">{passo.n}</span> : null}
          <span>
            {passo?.texto ? <Texto>{passo.texto}</Texto> : null}
            {passo?.detalhe ? (
              <small>
                <Texto>{passo.detalhe}</Texto>
              </small>
            ) : null}
          </span>
        </p>
        <div className="ajd-demo-controles">
          <button type="button" className="btn btn-ghost" aria-label="Passo anterior" disabled={!dados} onClick={() => irPara(marco - 1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-ghost" aria-label={tocando ? "Pausar" : "Tocar"} disabled={!dados} onClick={() => setTocar(!tocando)}>
            {tocando ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          </button>
          <button type="button" className="btn btn-ghost" aria-label="Próximo passo" disabled={!dados} onClick={() => irPara(marco + 1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          {marcos.length ? (
            <span>
              {marco + 1} de {marcos.length}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Telas = Pick<DadosDaDemonstracao, "barra" | "conta" | "cenas" | "camadas">;
type RefDeDiv = RefObject<HTMLDivElement | null>;

/** O app numa cena capturada: o menu da vitrine, a barra do topo, a cena no visor e o que estava por cima dela. */
function Replica({
  dados,
  cena,
  camada,
  chaveDaCamada,
  menu,
  altura = ALTURA,
  appRef,
  visorRef,
  cenaRef,
  camadaRef,
  children,
}: {
  dados: Telas;
  cena: number;
  camada?: string;
  chaveDaCamada: number;
  menu?: string;
  altura?: number;
  appRef: RefDeDiv;
  visorRef: RefDeDiv;
  cenaRef: RefDeDiv;
  camadaRef: RefDeDiv;
  children?: ReactNode;
}) {
  return (
    <div className="vitrine-app mockup-app" ref={appRef} inert style={{ height: altura }}>
      <MenuDaVitrine ativo={menu ?? ""} empresa={dados.conta.empresa} conta={dados.conta.nome} iniciais={dados.conta.iniciais} />
      <div className="vitrine-principal mockup-principal">
        <div dangerouslySetInnerHTML={{ __html: dados.barra }} />
        <div className="mockup-visor" ref={visorRef}>
          <div key={cena} ref={cenaRef} className="mockup-cena" dangerouslySetInnerHTML={{ __html: dados.cenas[cena] }} />
        </div>
      </div>
      {camada ? <div key={chaveDaCamada} ref={camadaRef} className="ajd-demo-camada" dangerouslySetInnerHTML={{ __html: camada }} /> : null}
      {children}
    </div>
  );
}

export type FiguraCapturada = {
  cena: number;
  camada: number | null;
  menu?: string;
  /** a altura da janela na captura: um painel inteiro pede mais que 800 */
  alturaDaTela: number;
  /** a folga em volta dos elementos, em px do app */
  pad: number;
  largura: number;
  altura: number;
};

export type DadosDasFiguras = Telas & { figuras: Record<string, FiguraCapturada> };

/**
 * A figura de uma seção da Central, no lugar da captura em imagem (que borrava): a mesma réplica da
 * demonstração, parada na cena que `gravar.mjs --figuras` capturou e recortada nos elementos marcados com
 * data-figura. O espaço vem de largura e altura (da página), reservado antes do arquivo chegar.
 */
export function FiguraDaTela({ src, id, largura, altura, rotulo }: { src: string; id: string; largura: number; altura: number; rotulo: string }) {
  const dados = useArquivo<DadosDasFiguras>(src);
  const figura = dados?.figuras[id];
  const quadro = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const visor = useRef<HTMLDivElement>(null);
  const cena = useRef<HTMLDivElement>(null);
  const camada = useRef<HTMLDivElement>(null);

  const aplicar = useCallback(() => {
    const [q, a, v, c] = [quadro.current, app.current, visor.current, cena.current];
    if (!figura || !q || !a || !v || !c) return;
    for (const raiz of [c, camada.current])
      for (const e of raiz?.querySelectorAll<HTMLElement>("[data-rolagem]") ?? []) e.scrollTop = Number(e.dataset.rolagem);
    // mede com a réplica em 1:1, em px do app
    a.style.transform = "none";
    c.style.transform = "none";
    const marcados = [...a.querySelectorAll(`[data-figura="${id}"]`)];
    const rs = marcados.map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height);
    if (!rs.length) return;
    const ra = a.getBoundingClientRect();
    const x = Math.min(...rs.map((r) => r.left)) - ra.left;
    let y = Math.min(...rs.map((r) => r.top)) - ra.top;
    const w = Math.max(...rs.map((r) => r.right)) - ra.left - x;
    // na cena, ela rola até a figura ficar no alto do visor; numa janela por cima, só ela aparece
    const naCena = c.contains(marcados[0]);
    q.toggleAttribute("data-na-camada", !naCena);
    if (naCena) {
      const rv = v.getBoundingClientRect();
      const rolagem = entre(y - figura.pad - (rv.top - ra.top), 0, c.getBoundingClientRect().height - rv.height);
      c.style.transform = `translateY(${-rolagem}px)`;
      y -= rolagem;
    }
    a.style.transform = `scale(${q.clientWidth / (w + 2 * figura.pad)}) translate(${figura.pad - x}px, ${figura.pad - y}px)`;
  }, [figura, id]);

  useLayoutEffect(() => aplicar(), [aplicar]);
  useLayoutEffect(() => {
    const q = quadro.current;
    if (!q || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(() => aplicar());
    observador.observe(q);
    return () => observador.disconnect();
  }, [aplicar]);

  return (
    <div className="ajd-fig" ref={quadro} role="img" aria-label={rotulo} style={{ aspectRatio: `${largura} / ${altura}` }}>
      {dados && figura ? (
        <Replica
          dados={dados}
          cena={figura.cena}
          camada={figura.camada == null ? undefined : dados.camadas?.[figura.camada]}
          chaveDaCamada={figura.camada ?? -1}
          menu={figura.menu}
          altura={figura.alturaDaTela}
          appRef={app}
          visorRef={visor}
          cenaRef={cena}
          camadaRef={camada}
        />
      ) : null}
    </div>
  );
}

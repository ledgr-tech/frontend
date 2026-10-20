"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { ABRIR_TUTORIAL } from "@/lib/eventos";
import type { TelaDoTutorial } from "@/lib/preferencias";
import { usePreferencias } from "../conta";
import { useColuna } from "../coluna/coluna";
import { temColuna } from "../coluna/estado";
import { FioDoTutorial } from "./fio-do-tutorial";
import { TUTORIAIS, type PassoDoTutorial } from "./roteiros";

const ATIVO = "data-tutorial-ativo";
/** As telas cujo tutorial já abriu sozinho nesta sessão: voltar a uma tela não o reabre. */
const VISTOS = "ledgr:tutoriais-vistos";
/** De quanto em quanto tempo o cartão olha se a tela já mostrou o que ele vai destacar. */
const INTERVALO_MS = 100;
/** A folga entre o alvo e a borda do buraco no véu, para o desfoque não encostar no conteúdo. */
const FOLGA = 8;
/** O canto do buraco: o --radius-md (16px) dos cartões mais a folga. */
const RAIO = 20;

function vistosNestaSessao(): string[] {
  try {
    const lista = JSON.parse(window.sessionStorage.getItem(VISTOS) ?? "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function marcarVisto(tela: TelaDoTutorial) {
  try {
    const lista = vistosNestaSessao();
    if (!lista.includes(tela)) window.sessionStorage.setItem(VISTOS, JSON.stringify([...lista, tela]));
  } catch {
    // sem armazenamento: o cartão pode reabrir ao voltar à tela, nada mais
  }
}

/** O elemento do passo, se está desenhado: no celular, a coluna Conferida da comparação some. */
function alvoDe(passo: PassoDoTutorial): HTMLElement | null {
  const alvo = document.querySelector<HTMLElement>(`[data-tutorial="${passo.alvo}"]`);
  return alvo && (alvo.checkVisibility?.() ?? true) ? alvo : null;
}

/**
 * O recorte do véu: a tela inteira menos um retângulo de cantos arredondados em volta do alvo, que
 * fica nítido no meio do desfoque (o evenodd faz do segundo retângulo um buraco no primeiro).
 */
function furo(x: number, y: number, largura: number, altura: number): string {
  const r = Math.min(RAIO, largura / 2, altura / 2);
  const l = largura - 2 * r;
  const a = altura - 2 * r;
  const tela = `M0 0H${window.innerWidth}V${window.innerHeight}H0Z`;
  const buraco =
    `M${x + r} ${y}h${l}a${r} ${r} 0 0 1 ${r} ${r}v${a}a${r} ${r} 0 0 1 ${-r} ${r}` +
    `h${-l}a${r} ${r} 0 0 1 ${-r} ${-r}v${-a}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
  return `path(evenodd, "${tela} ${buraco}")`;
}

/**
 * Rola até o alvo ficar na parte livre da tela: abaixo da barra do topo, que gruda na rolagem, e
 * acima do que cobre o rodapé quando ocupa a largura toda (celular): o cartão solto, ou o painel
 * das telas menores que o carrega. Na coluna das telas largas nada cobre a tela. Com "nearest", o que já está à vista
 * não se mexe; o alvo mais alto que o espaço livre fica com o começo à vista.
 */
function trazerParaAVista(alvo: HTMLElement, cartao: HTMLElement | null) {
  const naJanela = alvo.closest("dialog") !== null;
  const topo = naJanela ? 0 : (document.querySelector(".app-topo")?.getBoundingClientRect().bottom ?? 0);
  const quem = cartao?.closest<HTMLElement>("[data-painel]") ?? cartao;
  const caixa = quem?.getBoundingClientRect();
  // a folha sobe animada (translateY): o topo medido agora ainda está abaixo do final, que é a
  // borda de baixo menos a altura (não animada); vale o mais alto dos dois
  const topoDoCartao =
    !quem || !caixa || caixa.width <= window.innerWidth / 2 + 120
      ? window.innerHeight
      : quem.hasAttribute("data-painel")
        ? Math.min(caixa.top, window.innerHeight - quem.offsetHeight)
        : caixa.top;
  const margemTopo = Math.max(0, topo) + 2 * FOLGA;
  const margemBaixo = Math.max(0, window.innerHeight - topoDoCartao) + 2 * FOLGA;
  alvo.style.scrollMarginTop = `${margemTopo}px`;
  alvo.style.scrollMarginBottom = `${margemBaixo}px`;
  const suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // mais alto que a parte livre: "nearest" alinharia a borda de baixo e cortaria o começo; mostra o topo
  const cabe = alvo.getBoundingClientRect().height <= window.innerHeight - margemTopo - margemBaixo;
  alvo.scrollIntoView?.({ block: cabe ? "nearest" : "start", behavior: suave ? "smooth" : "auto" });
}

/**
 * O tutorial de uma tela (spec 2026-10-15-primeiro-uso, parte 3): um cartão do mascote no canto,
 * que destaca a parte da tela de cada passo. Abre sozinho na primeira visita; "Não mostrar de
 * novo" guarda na conta; o "?" da barra do topo reabre. Não é modal: dá para clicar fora.
 */
export function Tutorial({
  tela,
  atraso = 600,
  espera = 3000,
}: {
  tela: TelaDoTutorial;
  atraso?: number;
  /** Quanto o cartão espera a tela mostrar algum alvo antes de abrir assim mesmo, sem destaque. */
  espera?: number;
}) {
  const { carregado, tutorialDispensado, dispensarTutorial } = usePreferencias();
  const { nome, mascote, passos: todos } = TUTORIAIS[tela];
  // os passos desta abertura: só os do que está na tela
  const [passos, setPassos] = useState<PassoDoTutorial[]>(todos);
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [naoMostrar, setNaoMostrar] = useState(false);
  const { encaixeTutorial, mostrarParaTutorial, largas } = useColuna();
  // só as telas com coluna levam o cartão para lá; as outras (Configurações) o mantêm no canto
  const encaixe = temColuna(tela) ? encaixeTutorial : null;
  const desfazerColuna = useRef<(() => void) | null>(null);
  const cartao = useRef<HTMLDivElement | null>(null);
  // o cartão e o alvo também em estado, para o fio saber quando trocam
  const [cartaoNo, setCartaoNo] = useState<HTMLElement | null>(null);
  const [alvoNo, setAlvoNo] = useState<HTMLElement | null>(null);
  const guardarCartao = useCallback((no: HTMLDivElement | null) => {
    cartao.current = no;
    setCartaoNo(no);
  }, []);
  const destaque = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const titulo = useId();

  function abrir() {
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // numa tela vazia, só o "?" abre: aí vão todos os passos, sem destaque
    const naTela = todos.filter((passo) => alvoDe(passo));
    desfazerColuna.current?.();
    desfazerColuna.current = temColuna(tela) ? mostrarParaTutorial() : null;
    setPassos(naTela.length > 0 ? naTela : todos);
    setIndice(0);
    setNaoMostrar(false);
    setAberto(true);
  }

  function fechar() {
    if (naoMostrar) dispensarTutorial(tela);
    desfazerColuna.current?.();
    desfazerColuna.current = null;
    setAberto(false);
    focoAnterior.current?.focus?.();
  }

  // o Esc da janela e o "?" chamam sempre a versão atual (com a caixa como está agora)
  const acoes = useRef({ abrir, fechar });
  useEffect(() => {
    acoes.current = { abrir, fechar };
  });

  // primeira visita na sessão: abre quando a tela mostra o que o tutorial explica. Numa tela vazia
  // (a conta nova, sem extratos) não abre nem conta como vista: espera uma visita com conteúdo
  const dispensado = tutorialDispensado(tela);
  useEffect(() => {
    if (!carregado || dispensado || vistosNestaSessao().includes(tela)) return;
    const inicio = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const tentar = () => {
      if (todos.some((passo) => alvoDe(passo))) {
        marcarVisto(tela);
        acoes.current.abrir();
      } else if (Date.now() - inicio < espera) {
        timer = setTimeout(tentar, INTERVALO_MS);
      }
    };
    timer = setTimeout(tentar, atraso);
    return () => clearTimeout(timer);
    // só quando as preferências chegam: dispensar no meio não reabre nada
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregado]);

  // desmontar com o tutorial aberto devolve a coluna como estava
  useEffect(() => {
    const desfazer = desfazerColuna;
    return () => desfazer.current?.();
  }, []);

  // o "?" da barra do topo
  useEffect(() => {
    const reabrir = () => acoes.current.abrir();
    window.addEventListener(ABRIR_TUTORIAL, reabrir);
    return () => window.removeEventListener(ABRIR_TUTORIAL, reabrir);
  }, []);

  // Esc com o foco em qualquer lugar da página; dentro de uma janela <dialog>, o Esc é dela
  useEffect(() => {
    if (!aberto) return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
      acoes.current.fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  // destaque do passo atual: espera o alvo aparecer (a tela pode ainda estar carregando) e sai ao
  // trocar de passo, fechar ou desmontar. O véu é uma camada fixa por cima da tela inteira (o menu
  // desfoca junto) com um buraco que segue o alvo quadro a quadro, enquanto a página rola ou muda
  // de tamanho; só reescreve o recorte quando ele muda, para não repintar o desfoque à toa
  useEffect(() => {
    if (!aberto) return;
    const passo = passos[indice];
    const veu = destaque.current;
    const inicio = Date.now();
    let alvo: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let quadro = 0;
    let ultimo = "";
    const seguir = () => {
      if (!alvo || !veu) return;
      const { top, left, width, height } = alvo.getBoundingClientRect();
      veu.hidden = width === 0 && height === 0;
      const recorte = furo(left - FOLGA, top - FOLGA, width + 2 * FOLGA, height + 2 * FOLGA);
      if (recorte !== ultimo) veu.style.clipPath = ultimo = recorte;
      quadro = requestAnimationFrame(seguir);
    };
    const destacar = () => {
      alvo = alvoDe(passo);
      if (!alvo) {
        if (Date.now() - inicio < espera) timer = setTimeout(destacar, INTERVALO_MS);
        return;
      }
      alvo.setAttribute(ATIVO, "");
      setAlvoNo(alvo);
      trazerParaAVista(alvo, cartao.current);
      seguir();
    };
    destacar();
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(quadro);
      if (veu) veu.hidden = true;
      setAlvoNo(null);
      if (!alvo) return;
      alvo.removeAttribute(ATIVO);
      alvo.style.scrollMarginTop = "";
      alvo.style.scrollMarginBottom = "";
    };
  }, [aberto, indice, passos, espera]);

  useEffect(() => {
    if (aberto) cartao.current?.focus();
    // o cartão pode trocar do canto para a coluna quando o encaixe chega: o foco segue o nó desenhado
  }, [aberto, indice, encaixe]);

  if (!aberto) return null;
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;

  const cartaoDoPasso = (
    <div
      ref={guardarCartao}
      role="dialog"
      aria-labelledby={titulo}
      tabIndex={-1}
      className="card tutorial"
      onKeyDown={(evento) => {
        if (evento.key !== "Escape") return;
        // dentro da janela de Configurações, o Esc fecha só o tutorial, não a janela
        evento.preventDefault();
        evento.stopPropagation();
        fechar();
      }}
    >
      <div className="tutorial-topo">
        <Image src={mascote} alt="" width={52} height={52} className="tutorial-mascote" />
        <span className="tutorial-contagem">{`${nome} · ${indice + 1} de ${passos.length}`}</span>
        <button type="button" className="app-icone-botao" aria-label="Fechar o tutorial" onClick={fechar}>
          <X size={16} />
        </button>
      </div>
      <h2 id={titulo} className="tutorial-titulo">
        {passo.titulo}
      </h2>
      <p className="tutorial-texto">{passo.texto}</p>
      <label className="tutorial-caixa">
        <input type="checkbox" checked={naoMostrar} onChange={(evento) => setNaoMostrar(evento.target.checked)} />
        Não mostrar de novo
      </label>
      <div className="tutorial-acoes">
        <span className="tutorial-pontos" aria-hidden="true">
          {passos.map((item, i) => (
            <span key={item.alvo} data-atual={i === indice || undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-ghost" onClick={fechar}>
          Pular
        </button>
        <button type="button" className="btn btn-primary" onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}>
          {ultimo ? "Entendi" : "Próximo"}
        </button>
      </div>
    </div>
  );
  return (
    <>
      <div ref={destaque} className="tutorial-destaque" aria-hidden="true" hidden />
      <FioDoTutorial key={indice} cartao={cartaoNo} alvo={alvoNo} largas={largas} />
      {encaixe ? createPortal(cartaoDoPasso, encaixe) : cartaoDoPasso}
    </>
  );
}

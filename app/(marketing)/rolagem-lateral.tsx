"use client";

import { useEffect, type RefObject } from "react";

/**
 * O que as janelas do app na landing usam no celular, onde são mais largas que a tela e rolam para o lado
 * (o hero e "Na prática"; o CSS de cada uma em globals.css, "rolagem lateral"): o passeio sozinho até o fim
 * e de volta, e a dica de arrastar embaixo.
 */

/** até onde as janelas da landing rolam para o lado (o CSS usa o mesmo número: "rolagem lateral" em globals.css) */
export const LARGURA_DO_CELULAR = 680;

const suave = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Na primeira vez que o elemento que rola (`seletor`, dentro de `caixa`) aparece quase inteiro numa tela de até
 * `largura`, ele passeia sozinho até o fim e volta, para mostrar que tem mais. Uma vez só; um toque nele para o
 * passeio, e com movimento reduzido ele não acontece. `espera` é quanto aguardar antes de sair andando.
 * Com `espiada`, em vez de ir até o fim ele anda só esses pixels e volta, rápido: para uma segunda janela, em
 * que a pessoa já viu o passeio inteiro no hero e só precisa lembrar que tem mais do lado.
 */
export function usePasseioNoCelular(
  caixa: RefObject<HTMLElement | null>,
  seletor: string,
  {
    reduzido,
    largura,
    espera: aguardar = 1800,
    espiada,
  }: { reduzido: boolean; largura: number; espera?: number; espiada?: number },
) {
  useEffect(() => {
    const rolagem = caixa.current?.querySelector<HTMLElement>(seletor);
    if (reduzido || !rolagem || typeof IntersectionObserver === "undefined") return;
    if (!window.matchMedia?.(`(max-width: ${largura}px)`).matches) return;
    let quadro = 0;
    let espera = 0;
    let parado = false;
    const parar = () => {
      parado = true;
      cancelAnimationFrame(quadro);
      clearTimeout(espera);
    };
    /** desliza de onde está até `destino` em `ms`, e chama `depois` */
    const deslizar = (destino: number, ms: number, depois?: () => void) => {
      const origem = rolagem.scrollLeft;
      const inicio = performance.now();
      const passo = (agora: number) => {
        if (parado) return;
        const t = Math.min(1, (agora - inicio) / ms);
        rolagem.scrollLeft = origem + (destino - origem) * suave(t);
        if (t < 1) quadro = requestAnimationFrame(passo);
        else depois?.();
      };
      quadro = requestAnimationFrame(passo);
    };
    const observador = new IntersectionObserver(
      ([entrada]) => {
        // isIntersecting já vale com um pixel à vista (e o observe entrega o estado inicial): o limite de 60%
        // só vale olhando a proporção
        if (entrada.intersectionRatio < 0.6) return;
        observador.disconnect();
        espera = window.setTimeout(() => {
          const fim = rolagem.scrollWidth - rolagem.clientWidth;
          if (fim <= 0) return;
          if (espiada) {
            deslizar(Math.min(espiada, fim), 450, () => {
              espera = window.setTimeout(() => deslizar(0, 550), 200);
            });
            return;
          }
          deslizar(fim, 2600, () => {
            espera = window.setTimeout(() => deslizar(0, 1800), 1400);
          });
        }, aguardar);
      },
      { threshold: 0.6 },
    );
    observador.observe(rolagem);
    rolagem.addEventListener("pointerdown", parar, { once: true });
    rolagem.addEventListener("wheel", parar, { once: true, passive: true });
    return () => {
      parar();
      observador.disconnect();
      rolagem.removeEventListener("pointerdown", parar);
      rolagem.removeEventListener("wheel", parar);
    };
  }, [caixa, seletor, reduzido, largura, aguardar, espiada]);
}

/** "Arraste para ver a tela toda" com a seta da casa. Some fora do celular pelo CSS de quem a usa. */
export function DicaDeArrastar({ texto = "Arraste para ver a tela toda" }: { texto?: string }) {
  return (
    <p className="kin-arraste" aria-hidden="true">
      {texto}
      {/* a seta da casa: o fio em onda da linha do tempo de "Por que" (por-que.tsx), deitado */}
      <span className="kin-arraste-seta">
        <span className="kin-arraste-fio" />
        <svg viewBox="0 0 10 16">
          <path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </p>
  );
}

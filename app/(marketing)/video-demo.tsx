"use client";

import { m, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * O vídeo do produto (35 s, sem som, gravado com a conta de teste), numa janela como a da vitrine.
 * `preload="none"` e a capa: ele só baixa quando chega perto da tela, toca enquanto está nela e pausa
 * quando sai. Com movimento reduzido não toca sozinho; os controles ficam sempre. A janela se
 * endireita conforme entra na tela.
 */
export function VideoDemo({ src, capa, descricao }: { src: string; capa: string; descricao: string }) {
  const palco = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const reduzido = useReducedMotion();
  const naTela = useInView(video, { amount: 0.4 });

  useEffect(() => {
    const elemento = video.current;
    if (!elemento || reduzido) return;
    if (naTela) {
      elemento.muted = true;
      // navegador antigo (e o jsdom) devolve undefined em vez da promessa; recusa de autoplay não é erro
      Promise.resolve(elemento.play()).catch(() => {});
    } else {
      elemento.pause();
    }
  }, [naTela, reduzido]);

  const { scrollYProgress } = useScroll({ target: palco, offset: ["start end", "start 0.3"] });
  // endireitada, sem transformação nenhuma: uma camada 3D parada custaria em todo quadro da página
  const janela = useTransform(scrollYProgress, (v) =>
    v >= 1 ? "none" : `perspective(1600px) translateY(${70 * (1 - v)}px) rotateX(${20 * (1 - v)}deg) scale(${0.86 + 0.14 * v})`,
  );

  return (
    <figure className="vitrine video-demo" ref={palco}>
      <m.div data-reveal style={reduzido ? undefined : { transform: janela }}>
        <div className="vitrine-janela">
          <div className="vitrine-barra" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <video ref={video} src={src} poster={capa} muted loop playsInline controls preload="none" aria-label={descricao} />
        </div>
      </m.div>
      <figcaption className="video-demo-legenda">Gravação real do Ledgr, com dados de teste · 35 segundos, sem som</figcaption>
    </figure>
  );
}

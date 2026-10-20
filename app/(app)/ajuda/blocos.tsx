"use client";

import { useRef } from "react";
import Link from "next/link";
import { CircleHelp, Scale } from "lucide-react";
import type { PaginaDeAjuda } from "./paginas";

const ICONE = { size: 18, "aria-hidden": true } as const;

/** Os passos numerados, no desenho do "Como funciona" da Nova conciliação. */
export function PassosDaAjuda({
  pagina,
  emLinha = false,
  onRealce,
}: {
  pagina: PaginaDeAjuda;
  emLinha?: boolean;
  /** Passar o mouse num passo realça o número dele na miniatura. */
  onRealce?: (passo: number | null) => void;
}) {
  return (
    <ol className={emLinha ? "ajd-passos ajd-passos-em-linha" : "ajd-passos"}>
      {pagina.passos.map((passo, i) => (
        <li
          key={passo.titulo}
          onMouseEnter={() => onRealce?.(i)}
          onMouseLeave={() => onRealce?.(null)}
        >
          <span className="ajd-passo-numero" aria-hidden="true">
            {i + 1}
          </span>
          <strong>{passo.titulo}</strong>
          <span>{passo.texto}</span>
        </li>
      ))}
    </ol>
  );
}

export function NotaDaAjuda({ pagina }: { pagina: PaginaDeAjuda }) {
  return (
    <p className="nova-nota">
      <Scale {...ICONE} />
      {pagina.nota}
    </p>
  );
}

export function SeDerErrado({
  pagina,
  onIr,
}: {
  pagina: PaginaDeAjuda;
  onIr?: () => void;
}) {
  if (!pagina.seDerErrado) return null;
  const { texto, pagina: destino, link } = pagina.seDerErrado;
  return (
    <p className="nova-nota nova-nota-destaque">
      <CircleHelp {...ICONE} />
      <span>
        <strong>Se der errado.</strong> {texto}{" "}
        <Link href={`/ajuda/${destino}`} className="ajd-link" onClick={onIr}>
          {link}
        </Link>
      </span>
    </p>
  );
}

/** O vídeo da página, com os capítulos pulando para o tempo; sem gravação, nada. */
export function VideoDaAjuda({ pagina }: { pagina: PaginaDeAjuda }) {
  const video = useRef<HTMLVideoElement>(null);
  if (!pagina.video) return null;
  return (
    <figure className="ajd-video">
      <video
        ref={video}
        src={pagina.video.src}
        controls
        preload="metadata"
        aria-label={`Vídeo: ${pagina.titulo}`}
      />
      <figcaption className="ajd-capitulos">
        <span>Capítulos</span>
        {pagina.video.capitulos.map(([tempo, nome]) => (
          <button
            key={tempo}
            type="button"
            className="ajd-capitulo"
            onClick={() => {
              if (!video.current) return;
              const [min, seg] = tempo.split(":").map(Number);
              video.current.currentTime = min * 60 + seg;
              void video.current.play().catch(() => {});
            }}
          >
            <b>{tempo}</b>
            {nome}
          </button>
        ))}
      </figcaption>
    </figure>
  );
}

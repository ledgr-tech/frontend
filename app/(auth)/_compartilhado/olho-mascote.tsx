// olho no traço do mascote: sobrancelha em arco e pupila preta em gota com o recorte de brilho;
// fechado vira a pálpebra curva com cílios
// os dois estados ficam sempre no SVG: o CSS (.olho-mascote em globals.css) anima a troca como uma piscada
export function OlhoMascote({ fechado }: { fechado: boolean }) {
  return (
    <svg
      className="olho-mascote"
      data-estado={fechado ? "fechado" : "aberto"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* riscos de impacto de desenho animado: só piscam no instante em que o olho salta */}
      <path className="olho-impacto" d="M3.6 8.6l-2-1.2M3.2 12.8H.9M3.6 17l-2 1.2M20.4 8.6l2-1.2M20.8 12.8h2.3M20.4 17l2 1.2" />
      <path className="olho-sobrancelha" d="M7.2 5.2c2.7-1.9 6.9-1.9 9.6 0" />
      <g className="olho-aberto">
        <ellipse cx="12" cy="13.6" rx="4.4" ry="5.8" fill="currentColor" stroke="none" transform="rotate(-6 12 13.6)" />
        {/* brilho em cunha aberto na borda da pupila, como nos olhos do mascote */}
        <path d="M6.6 11.2l5.9 2.8-5.7 2.9z" fill="var(--color-bg)" stroke="none" />
        <path d="M15.3 19c.9.3 1.8.2 2.6-.3" />
      </g>
      <g className="olho-fechado">
        <path d="M7 13c2.9 3.4 7.1 3.4 10 0" />
        <path d="M9.1 15.7l-.8 1.7M12 16.6v1.9M14.9 15.7l.8 1.7" />
      </g>
    </svg>
  );
}

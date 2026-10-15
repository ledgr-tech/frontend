/**
 * As três barras do logo, lisas, em SVG para o menu do app: pintam com
 * `currentColor` e seguem a cor do texto, no claro e no escuro. O logo de
 * adesivo (`/mascotes/logo-barras.png`, barras desenhadas num contorno branco
 * só) fica no site, nas telas de acesso e na imagem de compartilhamento.
 */
export function LogoBarras({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1141 852" className={className} aria-hidden="true" focusable="false">
      <rect x="11" y="0" width="650" height="202" rx="101" fill="currentColor" />
      <rect x="22" y="330" width="1119" height="202" rx="101" fill="currentColor" />
      <rect x="0" y="650" width="948" height="202" rx="101" fill="currentColor" />
    </svg>
  );
}

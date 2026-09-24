/**
 * As três barras do logo, redesenhadas em SVG com as proporções de
 * `/mascotes/logo-barras.png`. O PNG é quase todo preto e sumiria no tema escuro;
 * aqui as barras pintam com `currentColor` e seguem a cor do texto.
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

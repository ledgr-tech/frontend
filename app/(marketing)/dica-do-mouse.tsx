import type { CSSProperties, ReactNode } from "react";

/**
 * A dica de que um bloco reage ao mouse: o ícone do mouse, com um anel que se expande e some e a
 * rodinha descendo, e o texto ao lado (globals.css, .hover-hint). `children` é o texto. Para dizer
 * outra coisa no toque, use .so-mouse e .so-toque dentro dele; quando no toque não há o que pedir,
 * className="so-mouse" esconde a dica inteira.
 */
export function DicaDoMouse({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className ? `hover-hint ${className}` : "hover-hint"} style={style}>
      <span className="hover-hint-icone">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round">
          <rect x="7" y="3" width="10" height="17" rx="5" />
          <path d="M12 3v5.5M7.2 8.5h9.6" />
          <path className="hover-hint-roda" d="M12 5v1.6" strokeWidth={1.75} />
        </svg>
      </span>
      <span className="hover-hint-texto">{children}</span>
    </div>
  );
}

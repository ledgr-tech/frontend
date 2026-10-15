import type { ReactNode } from "react";

// ponytail: os perfis ainda não existem, então os links apontam para "#". Quando existirem, é só
// trocar o href aqui: o link de fora abre em outra aba sozinho.
const REDES: { nome: string; href: string; icone: ReactNode }[] = [
  {
    nome: "LinkedIn",
    href: "#",
    icone: (
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"
      />
    ),
  },
  {
    nome: "Instagram",
    href: "#",
    // no traço dos ícones do app (lucide), e não a marca cheia: no círculo pequeno ela vira um borrão
    icone: (
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.25" />
        <path d="M17.5 6.5h.01" strokeWidth={2.6} />
      </g>
    ),
  },
  {
    nome: "X (Twitter)",
    href: "#",
    icone: (
      <path
        fill="currentColor"
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      />
    ),
  },
];

/** Os perfis do Ledgr, no rodapé: círculos com o filete das folhas, que acendem no dourado. */
export function RedesSociais() {
  return (
    <ul className="rodape-redes" aria-label="Ledgr nas redes sociais">
      {REDES.map((rede) => {
        const externo = rede.href.startsWith("http");
        return (
          <li key={rede.nome}>
            <a
              href={rede.href}
              className="rodape-rede"
              aria-label={rede.nome}
              title={rede.nome}
              {...(externo && { target: "_blank", rel: "noopener noreferrer" })}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                {rede.icone}
              </svg>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

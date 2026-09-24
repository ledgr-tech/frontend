"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarCheck,
  ChevronsUpDown,
  CreditCard,
  Files,
  History,
  House,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { EMPRESA_MOCK } from "@/lib/mock-data";
import { LogoBarras } from "./logo-barras";
import { alternarMenu } from "./menu";
import { aplicarTema, temaAtual, type Tema } from "./tema";

type ItemMenu = {
  nome: string;
  icone: LucideIcon;
  href: string;
  /** Rotas que deixam este item aceso, além do próprio href. */
  tambem?: string[];
};

// A visão geral (home, que o design não tem) e os cinco destinos do design
// (navItens em Ledgr.dc.html), na mesma ordem.
const ITENS: ItemMenu[] = [
  { nome: "Visão geral", icone: House, href: "/visao-geral" },
  { nome: "Extratos", icone: Files, href: "/extratos" },
  { nome: "Conciliações", icone: ArrowLeftRight, href: "/dashboard", tambem: ["/conciliacoes"] },
  { nome: "Fechamentos", icone: CalendarCheck, href: "/fechamentos" },
  { nome: "Histórico", icone: History, href: "/historico" },
  { nome: "Assinatura", icone: CreditCard, href: "/assinatura" },
];

// Traço fino e cor do texto: o ícone acompanha o filete do sistema em vez de
// competir com o nome do item.
const ICONE = { size: 18, strokeWidth: 1.5, "aria-hidden": true } as const;

function estaAtivo(item: ItemMenu, caminho: string): boolean {
  if (caminho === item.href) return true;
  return (item.tambem ?? []).some((prefixo) => caminho.startsWith(prefixo));
}

export function MenuLateral({ email, onSair }: { email: string; onSair: () => void }) {
  const caminho = usePathname();
  // null enquanto não sabemos: o tema só é legível no cliente, e chutar "claro"
  // faria o ícone trocar sozinho depois da hidratação
  const [tema, setTema] = useState<Tema | null>(null);
  const [contaAberta, setContaAberta] = useState(false);
  const caixaConta = useRef<HTMLDivElement>(null);
  const botaoRecolher = useRef<HTMLButtonElement>(null);
  const botaoAbrir = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(temaAtual());
  }, []);

  // Ctrl+B (⌘B no Mac) recolhe e abre — o atalho dos editores de código e do
  // sidebar do shadcn/ui, que é a referência de mercado para menu recolhível.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key.toLowerCase() === "b" && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault();
        alternarMenu();
      }
      if (evento.key === "Escape") setContaAberta(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (!caixaConta.current?.contains(evento.target as Node)) setContaAberta(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  // Recolher e abrir são dois botões, e o CSS mostra um de cada vez pelo atributo
  // de <html>. Assim o menu já abre certo antes da hidratação, sem estado no React.
  // O botão clicado some, então o foco passa para o que apareceu no lugar.
  function alternar() {
    const recolhido = alternarMenu();
    (recolhido ? botaoAbrir : botaoRecolher).current?.focus();
  }

  function alternarTema() {
    const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
    aplicarTema(proximo);
    setTema(proximo);
  }

  // o rótulo diz para onde vai, não onde está — é o que o design faz
  const rotuloTema = tema === "escuro" ? "Tema claro" : "Tema escuro";

  // "financeiro@telhacerta.com.br" → "Financeiro" e "FI"
  const apelido = email.split("@")[0] ?? "";
  const nome = apelido.charAt(0).toUpperCase() + apelido.slice(1);
  const iniciais = apelido.slice(0, 2).toUpperCase();

  return (
    <aside className="app-aside">
      <div className="app-aside-topo">
        <span className="app-aside-marca">
          <LogoBarras className="app-logo" />
          <span>Ledgr</span>
        </span>
        <button
          ref={botaoRecolher}
          type="button"
          className="app-icone-botao app-menu-recolher app-dica"
          aria-label="Recolher menu"
          data-dica="Recolher menu · Ctrl+B"
          onClick={alternar}
        >
          <PanelLeftClose {...ICONE} />
        </button>
        {/* recolhido, o logo é o próprio botão de abrir e vira o ícone no hover */}
        <button
          ref={botaoAbrir}
          type="button"
          className="app-menu-abrir app-dica"
          aria-label="Abrir menu"
          data-dica="Abrir menu · Ctrl+B"
          onClick={alternar}
        >
          <LogoBarras className="app-logo" />
          <PanelLeftOpen {...ICONE} className="app-menu-abrir-icone" />
        </button>
      </div>

      <Link
        href="/conciliacoes/nova"
        className="app-nav-item app-nav-nova app-dica"
        data-dica="Nova conciliação"
      >
        <Plus {...ICONE} />
        <span className="app-rotulo">Nova conciliação</span>
      </Link>

      <nav className="app-nav" aria-label="Seções do app">
        {ITENS.map((item) => {
          const Icone = item.icone;
          const ativo = estaAtivo(item, caminho);
          return (
            <Link
              key={item.nome}
              href={item.href}
              className="app-nav-item app-dica"
              data-dica={item.nome}
              aria-current={ativo ? "page" : undefined}
              data-ativo={ativo ? "true" : undefined}
            >
              <Icone {...ICONE} />
              <span className="app-rotulo">{item.nome}</span>
            </Link>
          );
        })}
      </nav>

      {/* ponytail: o assistente ainda não tem backend. Quando tiver, este bloco vira
          o botão que abre a conversa (bloco "chatbot" do APP em Ledgr.dc.html). */}
      <div className="app-assistente app-dica" data-dica="Fale com o Ledgr · em breve">
        <Image
          src="/mascotes/mascote-chatbot.png"
          alt=""
          width={1254}
          height={1254}
          sizes="36px"
          className="app-assistente-mascote"
        />
        <span className="app-rotulo app-assistente-texto">
          <span className="app-assistente-chamada">Assistente</span>
          <span className="app-assistente-titulo">Fale com o Ledgr</span>
          <span className="app-assistente-detalhe">em breve</span>
        </span>
      </div>

      <div className="app-aside-rodape">
        <div className="app-conta-envelope" ref={caixaConta}>
          <button
            type="button"
            className="app-conta app-dica"
            data-dica={`${nome} · ${EMPRESA_MOCK}`}
            aria-expanded={contaAberta}
            aria-controls={contaAberta ? "menu-conta" : undefined}
            onClick={() => setContaAberta((aberta) => !aberta)}
          >
            <span className="app-conta-iniciais" aria-hidden="true">
              {iniciais}
            </span>
            <span className="app-rotulo app-conta-texto">
              <span className="app-conta-nome">{nome}</span>
              <span className="app-conta-empresa">{EMPRESA_MOCK}</span>
            </span>
            <ChevronsUpDown {...ICONE} size={15} className="app-conta-seta" />
          </button>

          {contaAberta && (
            <div id="menu-conta" className="app-painel app-conta-painel">
              <span className="app-conta-email">{email}</span>
              <button type="button" className="app-conta-sair" onClick={onSair}>
                <LogOut {...ICONE} size={16} />
                Sair
              </button>
            </div>
          )}
        </div>

        {tema !== null && (
          <button
            type="button"
            className="app-icone-botao app-dica"
            aria-label={rotuloTema}
            data-dica={rotuloTema}
            onClick={alternarTema}
          >
            {tema === "escuro" ? <Sun {...ICONE} /> : <Moon {...ICONE} />}
          </button>
        )}
      </div>
    </aside>
  );
}

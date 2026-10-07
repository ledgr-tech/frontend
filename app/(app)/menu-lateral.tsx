"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as EventoMouse,
  type PointerEvent as EventoPonteiro,
} from "react";
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
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { PainelAssistente } from "./assistente/painel";
import { Configuracoes } from "./configuracoes";
import { LogoBarras } from "./logo-barras";
import { alternarMenu, menuRecolhido } from "./menu";
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

// Na cor do texto, com o traço do guia que o Shell passa a todo ícone (traco-icone.ts):
// o ícone acompanha o filete do sistema em vez de competir com o nome do item.
const ICONE = { size: 18, "aria-hidden": true } as const;

function estaAtivo(item: ItemMenu, caminho: string): boolean {
  if (caminho === item.href) return true;
  return (item.tambem ?? []).some((prefixo) => caminho.startsWith(prefixo));
}

// Recolhido, o menu abre por cima do conteúdo com o mouse parado nele: o "peek" do Notion e do
// Linear. 150 ms para não abrir com o mouse só de passagem, e 300 ms para fechar, para quem
// escorrega para fora e volta.
const ATRASO_ABRIR_MS = 150;
const ATRASO_FECHAR_MS = 300;

// A largura do menu aberto por cima anima entre a coluna de ícones e a de aberto (as duas no
// globals.css). É width, e não um recorte: os botões e o item aceso encolhem junto com o menu, e a
// coluna de ícones é o próprio menu aberto estreitado, sem troca de layout no fim (o modo ícone do
// shadcn/ui). Só o menu refaz o layout a cada quadro; ele passa por cima, e a página não se mexe.
const LARGURA_RECOLHIDO = "64px";
const LARGURA_ABERTO = "248px";
// A curva de gaveta do iOS (Ionic): sai menos de supetão que a curva forte do app, que punha ~85%
// do caminho no primeiro quarto do tempo e parecia um corte. 250 ms abrindo e 200 ms fechando, o
// par do Material (225/195 ms para o que entra e sai da tela), um pouco acima dos 200 ms do
// sidebar do shadcn/ui.
const CURVA = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURACAO_ABRIR_MS = 250;
const DURACAO_FECHAR_MS = 200;

/** Anima só onde dá e onde a pessoa não pediu menos movimento (o jsdom não tem element.animate). */
function podeAnimar(elemento: HTMLElement | null): elemento is HTMLElement {
  if (!elemento || typeof elemento.animate !== "function") return false;
  return !(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/**
 * Desliza o conteúdo da posição de antes até a nova (FLIP): a página já está no lugar novo e só o
 * transform anda, sem refazer o layout das tabelas a cada quadro.
 */
function deslizarConteudo(antes: number | undefined, duracao: number) {
  const principal = document.querySelector<HTMLElement>(".app-principal");
  if (antes === undefined || !podeAnimar(principal)) return;
  const deslocamento = antes - principal.getBoundingClientRect().left;
  if (deslocamento === 0) return;
  principal.animate({ transform: [`translateX(${deslocamento}px)`, "translateX(0)"] }, { duration: duracao, easing: CURVA });
}

export function MenuLateral({
  email,
  empresa,
  onSair,
}: {
  email: string;
  /** Vazia enquanto o backend não devolve a razão social: aí o cartão mostra só o nome. */
  empresa: string;
  onSair: () => void;
}) {
  const caminho = usePathname();
  // null enquanto não sabemos: o tema só é legível no cliente, e chutar "claro"
  // faria o ícone trocar sozinho depois da hidratação
  const [tema, setTema] = useState<Tema | null>(null);
  const [contaAberta, setContaAberta] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const botaoAssistente = useRef<HTMLButtonElement>(null);
  const caixaConta = useRef<HTMLDivElement>(null);
  const botaoConta = useRef<HTMLButtonElement>(null);
  const botaoRecolher = useRef<HTMLButtonElement>(null);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  // "aberto": recolhido, mas aberto por cima com o mouse; "fechando": o recorte voltando aos 64px
  const [espiar, setEspiar] = useState<"aberto" | "fechando" | null>(null);
  const [mouseDentro, setMouseDentro] = useState(false);
  const revelacao = useRef<Animation | null>(null);
  // o que foi aberto dali segura o menu aberto, mesmo com o mouse fora
  const algoAberto = contaAberta || assistenteAberto || configAberta;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(temaAtual());
  }, []);

  // abre por cima depois de um instante com o mouse parado no menu recolhido; deitado (até
  // 900px) ele não recolhe
  useEffect(() => {
    if (!mouseDentro || espiar !== null || !menuRecolhido()) return;
    if (window.matchMedia?.("(max-width: 900px)").matches) return;
    const timer = setTimeout(() => setEspiar("aberto"), ATRASO_ABRIR_MS);
    return () => clearTimeout(timer);
  }, [mouseDentro, espiar]);

  // e fecha um pouco depois que o mouse sai
  useEffect(() => {
    if (mouseDentro || espiar !== "aberto" || algoAberto) return;
    const timer = setTimeout(() => setEspiar(podeAnimar(menu.current) ? "fechando" : null), ATRASO_FECHAR_MS);
    return () => clearTimeout(timer);
  }, [mouseDentro, espiar, algoAberto]);

  // A largura anda antes da pintura, junto com a troca que o data-espiar faz no CSS. Interrompida no
  // meio (o mouse voltou enquanto fechava), parte de onde está, não do começo.
  useLayoutEffect(() => {
    const elemento = menu.current;
    const anterior = revelacao.current;
    const larguraAgora = anterior?.playState === "running" && elemento ? getComputedStyle(elemento).width : null;
    anterior?.cancel();
    revelacao.current = null;
    if (espiar === null || !podeAnimar(elemento)) return;
    if (espiar === "aberto") {
      revelacao.current = elemento.animate(
        { width: [larguraAgora ?? LARGURA_RECOLHIDO, LARGURA_ABERTO] },
        { duration: DURACAO_ABRIR_MS, easing: CURVA },
      );
      return;
    }
    // fechando: a largura fica parada nos 64px até o estado de recolhido entrar no lugar
    const fechar = elemento.animate(
      { width: [larguraAgora ?? LARGURA_ABERTO, LARGURA_RECOLHIDO] },
      { duration: DURACAO_FECHAR_MS, easing: CURVA, fill: "forwards" },
    );
    fechar.onfinish = () => setEspiar(null);
    revelacao.current = fechar;
  }, [espiar]);

  // só o mouse: no toque não existe "passar por cima", e o toque num ícone já é para navegar
  function aoEntrar(evento: EventoPonteiro) {
    if (evento.pointerType !== "mouse") return;
    setMouseDentro(true);
    if (espiar === "fechando") setEspiar("aberto");
  }

  function aoSair(evento: EventoPonteiro) {
    if (evento.pointerType === "mouse") setMouseDentro(false);
  }

  // Aberto por cima, ir para outra tela fecha o menu, como o peek do Notion e do Linear: aberto, ele
  // ficava sobre a tela nova enquanto ela carregava. O mouse continua em cima; só volta a abrir por
  // cima depois de sair e voltar. Ctrl+clique abre em outra aba, e aí a tela não muda.
  function aoNavegar(evento: EventoMouse) {
    if (!espiar || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
    setMouseDentro(false);
    setEspiar(podeAnimar(menu.current) ? "fechando" : null);
  }

  // Ctrl+B (⌘B no Mac) recolhe e abre — o atalho dos editores de código e do
  // sidebar do shadcn/ui, que é a referência de mercado para menu recolhível.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      // sem animação: atalho de teclado troca na hora, como o Raycast e os editores
      if (evento.key.toLowerCase() === "b" && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault();
        // recolhido com o mouse em cima, só volta a abrir por cima depois que o mouse sair e voltar
        if (alternarMenu()) setMouseDentro(false);
        setEspiar(null);
      }
      // Ctrl+, (⌘, no Mac): o atalho de preferências do Mac, do Claude e dos editores
      if (evento.key === "," && (evento.metaKey || evento.ctrlKey)) {
        evento.preventDefault();
        setContaAberta(false);
        setConfigAberta(true);
      }
      if (evento.key === "Escape") setContaAberta(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  // O item que abriu as configurações sumiu junto com o menu da conta, então o
  // <dialog> não tem para onde devolver o foco: ele volta ao nome da conta. Roda
  // depois do efeito da janela (filho antes do pai), já com o modal fechado —
  // antes disso o resto da página está inerte e o foco não pega.
  const configJaAbriu = useRef(false);
  useEffect(() => {
    if (configAberta) {
      configJaAbriu.current = true;
      return;
    }
    if (configJaAbriu.current) botaoConta.current?.focus();
  }, [configAberta]);

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
    const antes = document.querySelector(".app-principal")?.getBoundingClientRect().left;
    const recolhido = alternarMenu();
    if (recolhido) {
      // recolhe deslizando: o menu fica por cima e encolhe até a coluna de ícones. O mouse está no
      // botão de recolher; só volta a abrir por cima depois de sair e voltar
      setMouseDentro(false);
      setEspiar(podeAnimar(menu.current) ? "fechando" : null);
    } else {
      setEspiar(null);
    }
    deslizarConteudo(antes, recolhido ? DURACAO_FECHAR_MS : DURACAO_ABRIR_MS);
    (recolhido ? botaoAbrir : botaoRecolher).current?.focus();
  }

  function alternarTema() {
    const proximo: Tema = tema === "escuro" ? "claro" : "escuro";
    aplicarTema(proximo);
    setTema(proximo);
  }

  // o rótulo diz para onde vai, não onde está — é o que o design faz
  const rotuloTema = tema === "escuro" ? "Tema claro" : "Tema escuro";
  // aberto por cima, o mesmo botão deixa o menu aberto de vez
  const rotuloAbrir = espiar ? "Fixar menu" : "Abrir menu";

  // "financeiro@telhacerta.com.br" → "Financeiro" e "FI"
  const apelido = email.split("@")[0] ?? "";
  const nome = apelido.charAt(0).toUpperCase() + apelido.slice(1);
  const iniciais = apelido.slice(0, 2).toUpperCase();

  return (
    <aside
      ref={menu}
      className="app-aside"
      data-espiar={espiar ?? undefined}
      onPointerEnter={aoEntrar}
      onPointerLeave={aoSair}
    >
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
        {/* recolhido, o logo é o próprio botão de abrir e vira o ícone no hover; aberto por
            cima, é só o ícone, ao lado da marca, e fixa o menu aberto */}
        <button
          ref={botaoAbrir}
          type="button"
          className="app-menu-abrir app-dica"
          aria-label={rotuloAbrir}
          data-dica={`${rotuloAbrir} · Ctrl+B`}
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
        onClick={aoNavegar}
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
              onClick={aoNavegar}
            >
              <Icone {...ICONE} />
              <span className="app-rotulo">{item.nome}</span>
            </Link>
          );
        })}
      </nav>

      {/* o cartão "chatbot" do APP em Ledgr.dc.html: abre a conversa num painel ao lado */}
      <div className="app-assistente-envelope">
        <button
          ref={botaoAssistente}
          type="button"
          className="app-assistente app-dica"
          data-dica="Fale com o Ledgr"
          aria-expanded={assistenteAberto}
          aria-controls={assistenteAberto ? "painel-assistente" : undefined}
          onClick={() => setAssistenteAberto((aberto) => !aberto)}
        >
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
            <span className="app-assistente-detalhe">Pergunte sobre o mês</span>
          </span>
        </button>
        {assistenteAberto && (
          <PainelAssistente
            id="painel-assistente"
            onFechar={() => {
              setAssistenteAberto(false);
              // o botão de fechar some com o painel: o foco volta ao cartão que o abriu
              botaoAssistente.current?.focus();
            }}
          />
        )}
      </div>

      <div className="app-aside-rodape">
        <div className="app-conta-envelope" ref={caixaConta}>
          <button
            ref={botaoConta}
            type="button"
            className="app-conta app-dica"
            data-dica={[nome, empresa].filter(Boolean).join(" · ")}
            aria-expanded={contaAberta}
            aria-controls={contaAberta ? "menu-conta" : undefined}
            onClick={() => setContaAberta((aberta) => !aberta)}
          >
            <span className="app-conta-iniciais" aria-hidden="true">
              {iniciais}
            </span>
            <span className="app-rotulo app-conta-texto">
              <span className="app-conta-nome">{nome}</span>
              {empresa && <span className="app-conta-empresa">{empresa}</span>}
            </span>
            <ChevronsUpDown {...ICONE} size={15} className="app-conta-seta" />
          </button>

          {contaAberta && (
            <div id="menu-conta" className="app-painel app-conta-painel">
              <span className="app-conta-email">{email}</span>
              <button
                type="button"
                className="app-conta-sair"
                onClick={() => {
                  setContaAberta(false);
                  setConfigAberta(true);
                }}
              >
                <Settings {...ICONE} size={16} />
                Configurações
                <span className="app-conta-atalho" aria-hidden="true">
                  Ctrl ,
                </span>
              </button>
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

      <Configuracoes
        aberta={configAberta}
        onFechar={() => setConfigAberta(false)}
        email={email}
        onSair={onSair}
        onTema={setTema}
      />
    </aside>
  );
}

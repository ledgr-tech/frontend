"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Info,
  Keyboard,
  LogOut,
  Palette,
  Search,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { toleranciaDaUltimaConciliacao } from "./conciliacoes/acoes";
import { aplicarDensidade, densidadeAtual, type Densidade } from "./densidade";
import { alternarMenu, menuRecolhido } from "./menu";
import { aplicarTema, escolhaDeTema, seguirSistema, temaDoSistema, type EscolhaDeTema, type Tema } from "./tema";

/**
 * As configurações, numa janela no meio da tela (como a do Claude): seções à
 * esquerda, com busca, e o conteúdo à direita. `<dialog>` nativo com
 * `showModal()`, que já prende o foco, fecha no Esc e devolve o foco ao sair.
 *
 * Só entra o que funciona de verdade: o que é preferência deste navegador (tema,
 * densidade, menu) muda na hora; o que é do backend aparece como ele está, sem
 * controle que finja salvar — a tolerância de data, por exemplo, não tem rota
 * para ser ajustada.
 */

type Linha = { titulo: string; descricao?: string; controle?: ReactNode };

type Secao = {
  id: string;
  nome: string;
  icone: LucideIcon;
  grupo: "Configurações" | "Ledgr";
  linhas: Linha[];
};

const NOTA_TEMA: Record<EscolhaDeTema, string> = {
  claro: "Modo claro, como no papel.",
  escuro: "Modo escuro em todas as telas. Poupa a vista nos fechamentos de fim de noite.",
  sistema: "Segue o tema do seu computador, e troca junto com ele.",
};

function Segmentado<T extends string>({
  rotulo,
  opcoes,
  valor,
  onEscolher,
}: {
  rotulo: string;
  opcoes: { id: T; rotulo: string }[];
  valor: T;
  onEscolher: (valor: T) => void;
}) {
  return (
    <div className="pills segmentado" role="group" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          className="pill"
          aria-pressed={valor === opcao.id}
          onClick={() => onEscolher(opcao.id)}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}

function Tecla({ children }: { children: ReactNode }) {
  return <kbd className="cfg-tecla">{children}</kbd>;
}

/** Sem acento e em minúsculas: "configuracao" acha "Configuração". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tolerancia(dias: number | null | undefined): string {
  if (dias === undefined) return "Carregando…";
  if (dias === null) return "Sem conciliação ainda";
  if (dias === 0) return "Mesmo dia";
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export function Configuracoes({
  aberta,
  onFechar,
  email,
  onSair,
  onTema,
}: {
  aberta: boolean;
  onFechar: () => void;
  email: string;
  onSair: () => void;
  /** Avisa o menu lateral, que mostra o botão de tema com o ícone do tema atual. */
  onTema: (tema: Tema) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [secaoId, setSecaoId] = useState("aparencia");
  const [busca, setBusca] = useState("");
  const [tema, setTema] = useState<EscolhaDeTema>("sistema");
  const [densidade, setDensidade] = useState<Densidade>("padrao");
  const [recolhido, setRecolhido] = useState(false);
  const [toleranciaDias, setToleranciaDias] = useState<number | null | undefined>(undefined);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberta && !elemento.open) {
      // as preferências podem ter mudado por fora (o botão de tema, o Ctrl+B)
      setTema(escolhaDeTema());
      setDensidade(densidadeAtual());
      setRecolhido(menuRecolhido());
      setMac(/Mac|iPhone|iPad/.test(navigator.platform));
      if (typeof elemento.showModal === "function") elemento.showModal();
      else elemento.setAttribute("open", "");
    }
    if (!aberta && elemento.open) {
      if (typeof elemento.close === "function") elemento.close();
      else elemento.removeAttribute("open");
    }
  }, [aberta]);

  // a tolerância é do backend: busca na primeira vez que a janela abre
  useEffect(() => {
    if (!aberta || toleranciaDias !== undefined) return;
    toleranciaDaUltimaConciliacao()
      .then(setToleranciaDias)
      .catch(() => setToleranciaDias(null));
  }, [aberta, toleranciaDias]);

  function escolherTema(escolha: EscolhaDeTema) {
    if (escolha === "sistema") seguirSistema();
    else aplicarTema(escolha);
    setTema(escolha);
    onTema(escolha === "sistema" ? temaDoSistema() : escolha);
  }

  function escolherDensidade(proxima: Densidade) {
    aplicarDensidade(proxima);
    setDensidade(proxima);
  }

  function escolherMenu(quer: boolean) {
    if (menuRecolhido() !== quer) alternarMenu();
    setRecolhido(quer);
  }

  const ctrl = mac ? "⌘" : "Ctrl";

  const secoes: Secao[] = [
    {
      id: "conta",
      nome: "Conta",
      icone: UserRound,
      grupo: "Configurações",
      linhas: [
        { titulo: "E-mail", descricao: "É com ele que você entra no Ledgr.", controle: <span className="cfg-valor">{email}</span> },
        {
          titulo: "Sessão",
          descricao:
            "Vale por 7 dias. Com “Manter sessão ativa” desmarcado no login, termina quando o navegador fecha.",
        },
        {
          titulo: "Sair desta conta",
          descricao: "Encerra a sessão neste navegador.",
          controle: (
            <button type="button" className="btn btn-secondary" onClick={onSair}>
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          ),
        },
      ],
    },
    {
      id: "aparencia",
      nome: "Aparência",
      icone: Palette,
      grupo: "Configurações",
      linhas: [
        {
          titulo: "Tema",
          descricao: NOTA_TEMA[tema],
          controle: (
            <Segmentado
              rotulo="Tema"
              valor={tema}
              onEscolher={escolherTema}
              opcoes={[
                { id: "claro", rotulo: "Claro" },
                { id: "escuro", rotulo: "Escuro" },
                { id: "sistema", rotulo: "Sistema" },
              ]}
            />
          ),
        },
        {
          titulo: "Densidade das tabelas",
          descricao: "Compacta deixa as linhas mais baixas, para ver mais lançamentos de uma vez.",
          controle: (
            <Segmentado
              rotulo="Densidade das tabelas"
              valor={densidade}
              onEscolher={escolherDensidade}
              opcoes={[
                { id: "padrao", rotulo: "Padrão" },
                { id: "compacta", rotulo: "Compacta" },
              ]}
            />
          ),
        },
        {
          titulo: "Menu lateral",
          descricao: `Recolhido, o menu mostra só os ícones. Atalho: ${ctrl}+B.`,
          controle: (
            <Segmentado
              rotulo="Menu lateral"
              valor={recolhido ? "recolhido" : "aberto"}
              onEscolher={(valor) => escolherMenu(valor === "recolhido")}
              opcoes={[
                { id: "aberto", rotulo: "Aberto" },
                { id: "recolhido", rotulo: "Recolhido" },
              ]}
            />
          ),
        },
      ],
    },
    {
      id: "conciliacao",
      nome: "Conciliação",
      icone: ArrowLeftRight,
      grupo: "Configurações",
      linhas: [
        {
          titulo: "Tolerância de data",
          descricao:
            "Quantos dias de diferença o motor aceita para casar dois lançamentos de mesmo valor. É a da última conciliação; ajustar por aqui chega quando o backend tiver a rota das configurações da empresa.",
          controle: <span className="cfg-valor">{tolerancia(toleranciaDias)}</span>,
        },
        {
          titulo: "Fonte da verdade",
          descricao:
            "O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como “o sistema diverge do banco”.",
          controle: <span className="cfg-valor">Extrato do banco</span>,
        },
        {
          titulo: "Explicações por IA",
          descricao:
            "Rodam só quando você pede, na tela da linha, e têm limite diário. A IA explica; quem decide é você.",
        },
      ],
    },
    {
      id: "atalhos",
      nome: "Atalhos de teclado",
      icone: Keyboard,
      grupo: "Configurações",
      linhas: [
        { titulo: "Buscar valor, fornecedor ou data", controle: <span className="cfg-teclas"><Tecla>{ctrl}</Tecla><Tecla>K</Tecla></span> },
        { titulo: "Recolher ou abrir o menu", controle: <span className="cfg-teclas"><Tecla>{ctrl}</Tecla><Tecla>B</Tecla></span> },
        { titulo: "Abrir as configurações", controle: <span className="cfg-teclas"><Tecla>{ctrl}</Tecla><Tecla>,</Tecla></span> },
        { titulo: "Fechar janelas e menus", controle: <span className="cfg-teclas"><Tecla>Esc</Tecla></span> },
      ],
    },
    {
      id: "privacidade",
      nome: "Privacidade",
      icone: ShieldCheck,
      grupo: "Ledgr",
      linhas: [
        {
          titulo: "Sessão protegida",
          descricao:
            "O acesso fica num cookie que a página não consegue ler, e o navegador nunca fala direto com o servidor do Ledgr: quem fala é o servidor do app.",
        },
        {
          titulo: "Explicações por IA",
          descricao:
            "Com a IA ligada, a descrição dos lançamentos divergentes vai ao provedor de IA com e-mail, CNPJ, CPF, telefone e números longos mascarados.",
        },
      ],
    },
    {
      id: "sobre",
      nome: "Sobre",
      icone: Info,
      grupo: "Ledgr",
      linhas: [
        { titulo: "Ledgr", descricao: "Conciliação do extrato do banco com o do sistema de gestão." },
        {
          titulo: "Site",
          controle: (
            <Link href="/" className="btn btn-secondary" onClick={onFechar}>
              Ver o site
            </Link>
          ),
        },
        {
          titulo: "Contato",
          controle: (
            <a href="mailto:ledgrtech@gmail.com" className="cfg-link">
              ledgrtech@gmail.com
            </a>
          ),
        },
      ],
    },
  ];

  const termo = normalizar(busca.trim());
  const achados = termo
    ? secoes
        .map((secao) => ({
          ...secao,
          linhas: secao.linhas.filter((linha) =>
            normalizar(`${secao.nome} ${linha.titulo} ${linha.descricao ?? ""}`).includes(termo),
          ),
        }))
        .filter((secao) => secao.linhas.length > 0)
    : null;
  const secao = secoes.find((item) => item.id === secaoId) ?? secoes[0];

  return (
    <dialog
      ref={dialogo}
      className="cfg"
      aria-label="Configurações"
      onClose={onFechar}
      // o clique no fundo escuro cai no próprio <dialog>; dentro da janela, cai num filho
      onClick={(evento) => evento.target === evento.currentTarget && onFechar()}
    >
      {/* fechada, a janela não tem conteúdo: nada dela fica no caminho do leitor de tela */}
      {aberta && (
        <div className="cfg-janela">
          <aside className="cfg-lado">
            <label className="cfg-busca">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Procurar"
                aria-label="Procurar nas configurações"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </label>
            {(["Configurações", "Ledgr"] as const).map((grupo) => (
              <div key={grupo} className="cfg-grupo">
                <p className="cfg-grupo-nome">{grupo}</p>
                <nav aria-label={grupo}>
                  {secoes
                    .filter((item) => item.grupo === grupo)
                    .map((item) => {
                      const Icone = item.icone;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="cfg-item"
                          aria-current={!achados && item.id === secao.id ? "page" : undefined}
                          onClick={() => {
                            setSecaoId(item.id);
                            setBusca("");
                          }}
                        >
                          <Icone size={17} strokeWidth={1.6} aria-hidden="true" />
                          {item.nome}
                        </button>
                      );
                    })}
                </nav>
              </div>
            ))}
          </aside>

          <div className="cfg-conteudo">
            <button type="button" className="cfg-fechar" aria-label="Fechar configurações" onClick={onFechar}>
              <X size={18} aria-hidden="true" />
            </button>

            {achados === null ? (
              <section aria-labelledby="cfg-secao">
                <h2 id="cfg-secao" className="cfg-titulo">
                  {secao.nome}
                </h2>
                <Linhas linhas={secao.linhas} />
              </section>
            ) : achados.length === 0 ? (
              <p className="cfg-vazio">{`Nada encontrado para “${busca.trim()}”.`}</p>
            ) : (
              achados.map((item) => (
                <section key={item.id} aria-labelledby={`cfg-achado-${item.id}`} className="cfg-achado">
                  <h2 id={`cfg-achado-${item.id}`} className="cfg-titulo">
                    {item.nome}
                  </h2>
                  <Linhas linhas={item.linhas} />
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

function Linhas({ linhas }: { linhas: Linha[] }) {
  return (
    <ul className="cfg-linhas">
      {linhas.map((linha) => (
        <li key={linha.titulo} className="cfg-linha">
          <div className="cfg-linha-texto">
            <span className="cfg-linha-titulo">{linha.titulo}</span>
            {linha.descricao && <span className="cfg-linha-descricao">{linha.descricao}</span>}
          </div>
          {linha.controle && <div className="cfg-linha-controle">{linha.controle}</div>}
        </li>
      ))}
    </ul>
  );
}

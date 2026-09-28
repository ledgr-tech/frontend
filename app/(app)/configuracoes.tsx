"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Info,
  Keyboard,
  Palette,
  Search,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { trocarSenha, type ResultadoConta } from "../(auth)/acoes";
import { MensagemErro } from "../(auth)/_compartilhado/mensagem-erro";
import { SENHA_MINIMA } from "../(auth)/cadastro/passos";
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

type CampoDaConta = { id: string; rotulo: string; tipo: "email" | "password"; autoComplete: string };

const SENHA_ATUAL: CampoDaConta = {
  id: "senha_atual",
  rotulo: "Senha atual",
  tipo: "password",
  autoComplete: "current-password",
};

/**
 * Trocar e-mail, trocar senha, excluir a conta: um botão que abre o formulário
 * na própria linha, embaixo do texto. Tudo pede a senha atual, e o erro que
 * aparece é o do servidor (senha errada, e-mail já usado, rota que ainda não
 * existe) — nada finge que salvou.
 */
function AcaoDaConta({
  abrir,
  confirmar,
  campos,
  aviso,
  perigo = false,
  feito,
  validar,
  enviar,
  children,
}: {
  abrir: string;
  confirmar: string;
  campos: CampoDaConta[];
  aviso?: string;
  perigo?: boolean;
  /** A confirmação que fica na linha depois de salvar. */
  feito?: string;
  validar?: (valores: Record<string, string>) => string | null;
  enviar: (valores: Record<string, string>) => Promise<ResultadoConta>;
  /** O que fica ao lado do botão enquanto o formulário está fechado (o e-mail atual). */
  children?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  const erroId = useId();
  const classeBotao = perigo ? "btn btn-perigo" : "btn btn-secondary";

  function fechar() {
    setAberto(false);
    setValores({});
    setErro("");
    // o botão volta no lugar do formulário: o foco vai para ele, não para o <body>
    requestAnimationFrame(() => botaoAbrir.current?.focus());
  }

  async function enviarFormulario(evento: FormEvent) {
    evento.preventDefault();
    const problema = campos.some((campo) => !valores[campo.id]?.trim())
      ? "Preencha todos os campos."
      : (validar?.(valores) ?? null);
    if (problema) {
      setErro(problema);
      return;
    }
    setEnviando(true);
    setErro("");
    const resultado = await enviar(valores).catch(
      // a action nem chegou ao servidor (rede caiu, deploy novo no meio)
      (): ResultadoConta => ({ ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." }),
    );
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setSalvo(true);
    fechar();
  }

  if (!aberto) {
    return (
      <div className="cfg-acao">
        {salvo && feito ? (
          <span className="cfg-feito" role="status">
            {feito}
          </span>
        ) : (
          children
        )}
        <button
          ref={botaoAbrir}
          type="button"
          className={classeBotao}
          onClick={() => {
            setSalvo(false);
            setAberto(true);
          }}
        >
          {abrir}
        </button>
      </div>
    );
  }

  return (
    <form className="cfg-form" onSubmit={enviarFormulario} noValidate aria-label={abrir}>
      {aviso && <p className="cfg-form-aviso">{aviso}</p>}
      {campos.map((campo, indice) => (
        <div key={campo.id} className="field">
          <label htmlFor={`cfg-${campo.id}`}>{campo.rotulo}</label>
          <input
            id={`cfg-${campo.id}`}
            className="input"
            type={campo.tipo}
            autoComplete={campo.autoComplete}
            // abriu porque a pessoa pediu: o foco vai para onde ela vai digitar
            autoFocus={indice === 0}
            // o erro é do formulário (senha errada, rota que não existe), não de um campo: sem borda vermelha
            aria-describedby={erro ? erroId : undefined}
            disabled={enviando}
            value={valores[campo.id] ?? ""}
            onChange={(evento) => setValores((atuais) => ({ ...atuais, [campo.id]: evento.target.value }))}
          />
        </div>
      ))}
      {erro && <MensagemErro id={erroId}>{erro}</MensagemErro>}
      <div className="cfg-form-botoes">
        <button type="submit" className={perigo ? "btn btn-perigo" : "btn btn-primary"} disabled={enviando}>
          {enviando ? "Salvando…" : confirmar}
        </button>
        <button type="button" className="btn btn-secondary" onClick={fechar} disabled={enviando}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function validarSenhaNova(valores: Record<string, string>): string | null {
  const nova = valores.senha_nova;
  if (nova.length < SENHA_MINIMA) return `A senha nova precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  // o bcrypt do backend corta em 72 bytes; acento conta 2
  if (new TextEncoder().encode(nova).length > 72) return "Senha longa demais. Use no máximo 72 caracteres.";
  if (nova !== valores.senha_confirmacao) return "A confirmação não bate com a senha nova.";
  return null;
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
        {
          titulo: "E-mail",
          descricao: "É com ele que você entra no Ledgr. Para trocar, por enquanto, escreva para ledgrtech@gmail.com.",
          // ponytail: o backend ainda não tem `POST /me/email` (backend #66). Quando tiver, o controle volta a
          // ser um AcaoDaConta com `trocarEmail`, que já está pronta e testada em (auth)/acoes.ts.
          controle: <span className="cfg-valor">{email}</span>,
        },
        {
          titulo: "Senha",
          descricao: "Troque quando quiser, e na hora se desconfiar que mais alguém sabe.",
          controle: (
            <AcaoDaConta
              abrir="Trocar senha"
              confirmar="Trocar senha"
              feito="Senha trocada."
              campos={[
                SENHA_ATUAL,
                { id: "senha_nova", rotulo: "Senha nova", tipo: "password", autoComplete: "new-password" },
                {
                  id: "senha_confirmacao",
                  rotulo: "Repita a senha nova",
                  tipo: "password",
                  autoComplete: "new-password",
                },
              ]}
              validar={validarSenhaNova}
              enviar={(valores) => trocarSenha(valores.senha_atual, valores.senha_nova)}
            />
          ),
        },
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
              Sair
            </button>
          ),
        },
        {
          titulo: "Excluir conta",
          descricao:
            "Apaga a sua conta e os dados da empresa no Ledgr: extratos, conciliações e histórico. Por enquanto, o pedido é feito por e-mail, a partir do e-mail da conta.",
          // ponytail: o backend ainda não tem `DELETE /me` (backend #68). Quando tiver, volta o AcaoDaConta com
          // `perigo` e `excluirConta` (pronta e testada em (auth)/acoes.ts), que pede a senha antes de apagar.
          controle: (
            <a href="mailto:ledgrtech@gmail.com?subject=Excluir%20conta" className="btn btn-secondary">
              Pedir por e-mail
            </a>
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

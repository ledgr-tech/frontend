"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useInView } from "motion/react";
import { useMovimentoReduzido } from "@/app/reveal";
import { JanelaDaIa, type EstadoDoChat } from "@/app/chat-de-ia";
import { NOME_DA_IA, type IaDaConexao } from "@/lib/conexao-ia";
import type { AbaDoPasso } from "./paginas";

/**
 * O vídeo da página "Conectar o ChatGPT ou o Claude", em HTML: copiar o endereço no Ledgr, adicionar na IA,
 * autorizar no Ledgr e perguntar. Segue a aba do passo a passo. Um relógio de 40 ms só roda com o quadro na
 * tela; com menos movimento, cada cena chega parada no seu fim. Tempos e textos do canvas aprovado em 11/11
 * (docs/superpowers/plans/anexos/2026-11-11-conexao-ia/central.dc.html).
 */
export const INICIO_DAS_CENAS = [0, 5000, 13500, 18500] as const;
export const VOLTA = 36000;
export const NOMES_DAS_CENAS = ["1 · Copiar no Ledgr", "2 · Adicionar na IA", "3 · Autorizar no Ledgr", "4 · Perguntar"] as const;
// o instante em que cada cena fica parada com menos movimento: o fim dela
const PARADO = [4999, 12999, 18499, VOLTA - 1];
const TECLA = 85;
const PALAVRA = 160;
// largura do palco no canvas: a rota do cursor vem em px dele e vira % aqui
const LARGURA_DO_CANVAS = 820;

const PERGUNTA = { chatgpt: "Agosto já foi fechado?", claude: "Como está a conciliação de agosto?" };
const RESPOSTA = {
  chatgpt: "Sim. Agosto está fechado, com 96,3% conciliado. O relatório do fechamento fica em Fechamentos, no Ledgr.",
  claude: "Agosto está 96,3% conciliado. Dos 4.218 lançamentos do extrato do banco, 157 ainda pedem revisão no Ledgr.",
};

export type QuadroDoVideo = {
  cena: 0 | 1 | 2 | 3;
  copiado: boolean;
  modal: { aberto: boolean; nome: string; url: string; risco: boolean; confirmou: boolean; conectou: boolean };
  autorizado: boolean;
  chat: EstadoDoChat;
  /** x em % da largura do palco, y em px. */
  cursor: { x: number; y: number };
};

const digitar = (texto: string, desde: number, agora: number, passo: number) =>
  agora < desde ? "" : texto.slice(0, Math.floor((agora - desde) / passo));

/** O que está na tela no instante t (ms, 0 até VOLTA) para a IA da aba. Pura, sem relógio. */
export function quadroDoVideo(t: number, ia: IaDaConexao, endereco: string): QuadroDoVideo {
  const gpt = ia === "chatgpt";
  const [, i1, i2, i3] = INICIO_DAS_CENAS;
  const cena = t >= i3 ? 3 : t >= i2 ? 2 : t >= i1 ? 1 : 0;
  const u1 = t - i1;
  const u3 = t - i3;

  // a conversa: digitar, enviar, consultar o Ledgr, responder palavra a palavra
  const pergunta = PERGUNTA[ia];
  const palavras = RESPOSTA[ia].split(" ");
  const dig = gpt ? 2500 : 3300;
  const envio = dig + pergunta.length * TECLA + 900;
  const consulta = envio + 900;
  const resposta = consulta + 2200;
  const enviada = u3 >= envio;
  const digitado = enviada ? "" : gpt && u3 < 2000 ? (u3 >= 800 ? "@" : "") : digitar(pergunta, dig, u3, TECLA);
  const chat: EstadoDoChat = {
    digitado,
    digitando: !enviada && u3 >= (gpt ? 800 : dig - 600),
    enviada: enviada ? pergunta : null,
    ferramenta: u3 < consulta ? "nada" : u3 < resposta - 300 ? "consultando" : "feito",
    resposta: palavras.map((texto, i) => ({ texto, visivel: u3 >= resposta + i * PALAVRA })),
    numeros: !gpt && u3 >= resposta + palavras.length * PALAVRA + 500,
    menuAberto: gpt ? u3 >= 900 && u3 < 2000 : u3 >= 1000 && u3 < 2700,
    ledgrLigado: gpt ? u3 >= 2000 : u3 >= 1900,
  };

  // o cursor: [a partir de, x, y] em px do palco do canvas
  const fimDaDigitacao = dig + pergunta.length * TECLA;
  const rota =
    cena === 0 ? [[0, 420, 300], [1600, 672, 200]]
    : cena === 1 ? [[i1, 520, 260], [i1 + 700, 690, 68], [i1 + 1800, 560, 162], [i1 + 2700, 560, 218], [i1 + 4500, 606, gpt ? 306 : 272], [i1 + 4800, 606, gpt ? 346 : 272], [i1 + 6400, 690, 162]]
    : cena === 2 ? [[i2, 520, 250], [i2 + 1400, 236, 386]]
    : gpt ? [[i3, 560, 360], [i3 + 600, 200, 256], [i3 + 1000, 230, 196], [i3 + 2100, 260, 256], [i3 + fimDaDigitacao, 708, 258], [i3 + envio + 700, 560, 160]]
    : [[i3, 520, 300], [i3 + 600, 157, 452], [i3 + 1700, 359, 355], [i3 + 2800, 260, 409], [i3 + fimDaDigitacao, 707, 452], [i3 + envio + 700, 520, 220]];
  let ponto = rota[0];
  for (const passo of rota) if (t >= passo[0]) ponto = passo;

  return {
    cena,
    copiado: cena === 0 && t >= 2400,
    modal: {
      aberto: u1 >= 1500 && u1 < 6000,
      nome: digitar("Ledgr", 2100, u1, 90),
      url: digitar(endereco, 2900, u1, 45),
      risco: u1 >= 4500,
      confirmou: u1 >= 5300,
      conectou: u1 >= 7200,
    },
    autorizado: cena === 2 && t >= i2 + 2300,
    chat,
    cursor: { x: (ponto[1] / LARGURA_DO_CANVAS) * 100, y: ponto[2] },
  };
}

const ligado = (valor: boolean) => (valor ? "true" : "false");

export function VideoDaConexao({ ia, endereco }: { ia: AbaDoPasso["id"]; endereco: string | null }) {
  // o Claude Code não tem conector na interface: o vídeo mostra o do Claude
  const iaDoVideo: IaDaConexao = ia === "chatgpt" ? "chatgpt" : "claude";
  const nome = NOME_DA_IA[iaDoVideo];
  const reduzido = useMovimentoReduzido(false);
  const quadro = useRef<HTMLDivElement>(null);
  const naTela = useInView(quadro, { amount: 0.4 });
  const [t, setT] = useState(0);
  const [tocando, setTocando] = useState(true);
  const [cenaParada, setCenaParada] = useState(3);

  // trocar de IA com a conversa na tela recomeça a conversa na IA nova
  const [iaVista, setIaVista] = useState(iaDoVideo);
  if (iaVista !== iaDoVideo) {
    setIaVista(iaDoVideo);
    if (t >= INICIO_DAS_CENAS[3]) setT(INICIO_DAS_CENAS[3]);
  }

  useEffect(() => {
    if (reduzido || !tocando || !naTela) return;
    const relogio = setInterval(() => setT((agora) => (agora + 40 >= VOLTA ? 0 : agora + 40)), 40);
    return () => clearInterval(relogio);
  }, [reduzido, tocando, naTela]);

  const instante = reduzido ? PARADO[cenaParada] : t;
  const q = quadroDoVideo(instante, iaDoVideo, endereco ?? "https://…/mcp");
  const gpt = iaDoVideo === "chatgpt";

  return (
    <div className="vdc" ref={quadro}>
      <p className="sr-only">
        {`O vídeo mostra os quatro passos: você copia o endereço do conector em Configurações › Conexões, adiciona o Ledgr no ${nome}, autoriza no Ledgr escolhendo a empresa e pergunta sobre agosto numa conversa.`}
      </p>
      <div className="vdc-palco grao" aria-hidden="true">
        <Image src="/mascotes/mascote-tomadas.webp" alt="" width={440} height={277} className="vdc-mascote" />

        <div className="vdc-cena vdc-cena-0" data-ligado={ligado(q.cena === 0)}>
          <div className="vdc-lado">
            <span className="vdc-lado-titulo">Configurações</span>
            {["Conta", "Aparência", "Conciliação", "API"].map((item) => (
              <span key={item}>{item}</span>
            ))}
            <span className="vdc-lado-ativo">Conexões</span>
          </div>
          <div className="vdc-ledgr">
            <span className="vdc-ledgr-titulo">Conexões</span>
            <span className="vdc-apagado">Você liga o Ledgr ao ChatGPT ou ao Claude uma vez. Depois, pergunta sobre os meses em português.</span>
            <span className="vdc-rotulo">Endereço do conector</span>
            <div className="vdc-endereco">
              <span>{endereco ?? "https://…/mcp"}</span>
              <span className="vdc-botao" data-feito={ligado(q.copiado)}>{q.copiado ? "Copiado" : "Copiar"}</span>
            </div>
            <span className="vdc-rotulo">Conexões ativas</span>
            <span className="vdc-apagado">Nenhuma conexão ainda.</span>
          </div>
        </div>

        <div className="vdc-cena vdc-cena-1" data-ligado={ligado(q.cena === 1)} data-ia={iaDoVideo}>
          <div className="vdc-ia-lado">
            <span className="vdc-ia-titulo">
              <Image src={`/mascotes/logo-${iaDoVideo}.png`} alt="" width={20} height={20} />
              Configurações
            </span>
            <span>Geral</span>
            <span>{gpt ? "Personalização" : "Perfil"}</span>
            <span className="vdc-ia-ativo">{gpt ? "Apps e conectores" : "Conectores"}</span>
            <span>Privacidade</span>
          </div>
          <div className="vdc-ia-corpo">
            <div className="vdc-ia-cabeca">
              <span>{gpt ? "Apps e conectores" : "Conectores"}</span>
              <span className="vdc-ia-novo">{gpt ? "+ Criar" : "Adicionar conector personalizado"}</span>
            </div>
            <span className="vdc-ia-explica">{gpt ? "Apps que o ChatGPT pode usar nas conversas." : "Permita que o Claude consulte seus apps e serviços."}</span>
            <div className="vdc-ia-linha" data-ligado={ligado(q.modal.confirmou)}>
              <Image src="/mascotes/logo-barras.png" alt="" width={16} height={13} />
              <span>Ledgr</span>
              <span className="vdc-ia-acao">{q.modal.conectou ? "Abrindo o Ledgr…" : "Conectar"}</span>
            </div>
            <div className="vdc-ia-fundo" data-ligado={ligado(q.modal.aberto)} />
            <div className="vdc-ia-modal" data-ligado={ligado(q.modal.aberto)}>
              <span className="vdc-ia-modal-titulo">{gpt ? "Novo app" : "Adicionar conector personalizado"}</span>
              <span className="vdc-ia-campo">
                Nome<span>{q.modal.nome}</span>
              </span>
              <span className="vdc-ia-campo">
                {gpt ? "URL do servidor MCP" : "URL do servidor MCP remoto"}
                <span>{q.modal.url}</span>
              </span>
              {gpt && (
                <>
                  <span className="vdc-ia-campo">
                    Autenticação<span>OAuth ⌄</span>
                  </span>
                  <span className="vdc-ia-risco">
                    <span data-ligado={ligado(q.modal.risco)} />
                    Entendo os riscos e quero continuar
                  </span>
                </>
              )}
              <div className="vdc-ia-botoes">
                <span>Cancelar</span>
                <span className="vdc-ia-confirma" data-ligado={ligado(q.modal.url !== "" && q.modal.url.length === (endereco ?? "https://…/mcp").length)}>
                  {gpt ? "Criar" : "Adicionar"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="vdc-cena vdc-cena-2" data-ligado={ligado(q.cena === 2)}>
          <div className="vdc-consentimento">
            <div className="vdc-logos">
              <Image src={`/mascotes/logo-${iaDoVideo}.png`} alt="" width={36} height={36} />
              <span aria-hidden="true">→</span>
              <Image src="/mascotes/logo-barras.png" alt="" width={40} height={33} />
            </div>
            <span className="vdc-consentimento-titulo">Conectar o {nome} ao Ledgr</span>
            <span className="vdc-apagado">
              O pedido vem de <strong>{gpt ? "chatgpt.com" : "claude.ai"}</strong>. Só leitura.
            </span>
            <span className="vdc-rotulo">De qual empresa</span>
            <span className="vdc-empresa" data-escolhida="true">Telha Certa Materiais de Construção Ltda</span>
            <span className="vdc-empresa">Construtora Horizonte Ltda</span>
            <div className="vdc-ia-botoes">
              <span className="vdc-botao" data-feito={ligado(q.autorizado)}>{q.autorizado ? "Autorizado" : "Autorizar"}</span>
              <span className="vdc-botao-calmo">Recusar</span>
            </div>
          </div>
        </div>

        <div className="vdc-cena vdc-cena-3" data-ligado={ligado(q.cena === 3)}>
          <JanelaDaIa key={iaDoVideo} ia={iaDoVideo} estado={q.chat} />
        </div>

        <svg className="vdc-cursor" data-ligado={ligado(!reduzido && tocando)} style={{ left: `${q.cursor.x}%`, top: q.cursor.y }} width="22" height="26" viewBox="0 0 22 26">
          <path d="M2 2l17 11-7.5 1.4L8 23z" fill="#0d0d0d" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="vdc-controles">
        {!reduzido && (
          <button type="button" className="vdc-tocar" aria-label={tocando ? "Pausar o vídeo" : "Tocar o vídeo"} onClick={() => setTocando(!tocando)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={tocando ? "M7 5h3v14H7zM14 5h3v14h-3z" : "M8 5l11 7-11 7z"} />
            </svg>
          </button>
        )}
        <div role="group" aria-label="Etapas do vídeo" className="vdc-etapas">
          {NOMES_DAS_CENAS.map((rotulo, i) => (
            <button
              key={rotulo}
              type="button"
              aria-pressed={q.cena === i}
              onClick={() => (reduzido ? setCenaParada(i) : setT(INICIO_DAS_CENAS[i]))}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <span className="vdc-legenda">
          {ia === "claude-code"
            ? "No Claude Code, o passo 2 é o comando do terminal; o resto é igual."
            : "O vídeo segue a IA escolhida no passo a passo."}
        </span>
      </div>
    </div>
  );
}

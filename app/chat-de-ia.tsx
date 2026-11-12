import Image from "next/image";
import type { IaDaConexao } from "@/lib/conexao-ia";

/**
 * O Claude e o ChatGPT consultando o Ledgr, desenhados em HTML para a landing e para o vídeo da Central. Só
 * apresentação: quem anima passa o estado de cada instante. As cores são as das próprias IAs, não do Ledgr,
 * e quem usa põe embaixo a nota de que é uma simulação.
 */
export type EstadoDoChat = {
  /** O que está digitado no campo; cada letra entra esmaecendo. */
  digitado: string;
  /** O cursor de texto piscando no campo. */
  digitando: boolean;
  /** A pergunta já enviada, como bolha; null antes do envio. */
  enviada: string | null;
  ferramenta: "nada" | "consultando" | "feito";
  /** Palavras da resposta; `visivel` liga a entrada de cada uma. */
  resposta: { texto: string; visivel: boolean }[];
  /** Só no Claude: os dois números do mês embaixo da resposta. */
  numeros: boolean;
  /** Claude: o menu de ferramentas. ChatGPT: o menu "Apps" do @. */
  menuAberto: boolean;
  /** O Ledgr ligado na conversa: a chave do Claude, o chip do ChatGPT. */
  ledgrLigado: boolean;
};

const LOGO = { chatgpt: "/mascotes/logo-chatgpt.png", claude: "/mascotes/logo-claude.png" };

function Logo({ ia, tamanho }: { ia: IaDaConexao; tamanho: number }) {
  return <Image src={LOGO[ia]} width={tamanho} height={tamanho} alt="" />;
}

function Ledgr({ altura }: { altura: number }) {
  return <Image src="/mascotes/logo-barras.png" width={Math.round(altura * 1.2)} height={altura} alt="" className="chat-ia-ledgr" />;
}

/** O texto que esmaece: `data-ligado` diz se está na tela; o CSS faz a entrada. */
const ligado = (valor: boolean) => (valor ? "true" : "false");

function Campo({ estado, placeholder }: { estado: EstadoDoChat; placeholder: string }) {
  const vazio = estado.digitado === "";
  return (
    <span className="chat-ia-campo" data-vazio={ligado(vazio)}>
      {vazio && !estado.digitando
        ? placeholder
        : estado.digitado.split("").map((letra, i) => (
            <span key={i} className="letra">
              {letra}
            </span>
          ))}
      {estado.digitando && <span className="chat-ia-caret" />}
    </span>
  );
}

function Resposta({ estado, className }: { estado: EstadoDoChat; className: string }) {
  return (
    <p className={className}>
      {estado.resposta.map((palavra, i) => (
        <span key={i} className={`chat-ia-palavra${palavra.visivel ? " visivel" : ""}`}>
          {palavra.texto}{" "}
        </span>
      ))}
    </p>
  );
}

function Icone({ d, tamanho = 18 }: { d: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const MAIS = "M12 5v14M5 12h14";
const ENVIAR = "M12 19V5M5 12l7-7 7 7";

/** O Claude: barra lateral, saudação, a conversa e o compositor com o menu de ferramentas. */
export function JanelaDoClaude({ estado, compacta = false }: { estado: EstadoDoChat; compacta?: boolean }) {
  const enviada = estado.enviada !== null;
  const consultando = estado.ferramenta === "consultando";
  return (
    <div className="chat-ia chat-ia-claude" data-compacta={ligado(compacta)} aria-hidden="true">
      <div className="chat-ia-lado">
        <Icone d="M3 7a3 3 0 013-3h12a3 3 0 013 3v10a3 3 0 01-3 3H6a3 3 0 01-3-3zM9 4v16" />
        <span className="chat-ia-lado-mais"><Icone d={MAIS} tamanho={14} /></span>
        <Icone d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
        <Icone d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <span className="chat-ia-avatar">A</span>
      </div>
      <div className="chat-ia-corpo">
        <div className="chat-ia-topo">
          <span className="chat-ia-suave" data-ligado={ligado(enviada)}>
            Conciliação de agosto <span className="chat-ia-apagado">⌄</span>
          </span>
        </div>
        <div className="chat-ia-saudacao chat-ia-suave" data-ligado={ligado(!enviada)}>
          <span>
            <Logo ia="claude" tamanho={34} />
            Boa tarde, Ana
          </span>
        </div>
        <div className="chat-ia-conversa">
          {enviada && <span className="chat-ia-bolha">{estado.enviada}</span>}
          <span className="chat-ia-ferramenta chat-ia-suave" data-ligado={ligado(estado.ferramenta !== "nada")}>
            {consultando ? <span className="chat-ia-gira" /> : <Ledgr altura={11} />}
            <span>{consultando ? "Consultando o Ledgr" : "Ledgr · Resumo do mês"}</span>
            <span className="chat-ia-apagado chat-ia-fim">›</span>
          </span>
          <Resposta estado={estado} className="chat-ia-resposta" />
          <div className="chat-ia-numeros chat-ia-suave" data-ligado={ligado(estado.numeros)}>
            <div>
              <strong>96,3%</strong>
              <span>conciliado</span>
            </div>
            <div>
              <strong>157</strong>
              <span>de 4.218 para revisar</span>
            </div>
          </div>
        </div>
        <div className="chat-ia-compositor">
          <div className="chat-ia-menu chat-ia-suave" data-ligado={ligado(estado.menuAberto)}>
            <div className="chat-ia-menu-item">
              <Icone d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5" tamanho={15} />
              <span>Pesquisa na web</span>
              <span className="chat-ia-chave" data-ligado="false"><span /></span>
            </div>
            <div className="chat-ia-menu-item chat-ia-menu-ledgr">
              <Ledgr altura={13} />
              <span>Ledgr</span>
              <span className="chat-ia-chave" data-ligado={ligado(estado.ledgrLigado)}><span /></span>
            </div>
            <div className="chat-ia-menu-rodape">Gerenciar conectores</div>
          </div>
          <Campo estado={estado} placeholder={enviada ? "Responder ao Claude…" : "Como posso ajudar você hoje?"} />
          <div className="chat-ia-barra">
            <span className="chat-ia-botao"><Icone d={MAIS} tamanho={15} /></span>
            <span className="chat-ia-botao" data-ligado={ligado(estado.menuAberto)}>
              <Icone d="M4 7h10M18 7h2M4 17h4M12 17h8M16 5a2 2 0 110 4 2 2 0 010-4zM10 15a2 2 0 110 4 2 2 0 010-4z" tamanho={15} />
            </span>
            <span className="chat-ia-chip chat-ia-suave" data-ligado={ligado(estado.ledgrLigado && !estado.menuAberto)}>
              <Ledgr altura={10} />
              Ledgr
            </span>
            <span className="chat-ia-modelo">Sonnet 4.5 ⌄</span>
            <span className="chat-ia-enviar" data-ligado={ligado(estado.digitado !== "" && !enviada)}>
              <Icone d={ENVIAR} tamanho={14} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** O ChatGPT: cabeçalho, saudação, a pílula que desce depois do envio e o menu "Apps" do @. */
export function JanelaDoChatGpt({ estado }: { estado: EstadoDoChat }) {
  const enviada = estado.enviada !== null;
  const consultando = estado.ferramenta === "consultando";
  const completa = estado.resposta.length > 0 && estado.resposta.every((palavra) => palavra.visivel);
  return (
    <div className="chat-ia chat-ia-gpt" data-enviada={ligado(enviada)} aria-hidden="true">
      <div className="chat-ia-corpo">
        <div className="chat-ia-topo chat-ia-topo-gpt">
          <span>
            <Logo ia="chatgpt" tamanho={22} />
            ChatGPT <span className="chat-ia-apagado">⌄</span>
          </span>
          <Icone d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
        </div>
        <div className="chat-ia-saudacao chat-ia-suave" data-ligado={ligado(!enviada)}>
          <span>Em que você está pensando hoje?</span>
        </div>
        <div className="chat-ia-conversa">
          {enviada && <span className="chat-ia-bolha">{estado.enviada}</span>}
          <span className="chat-ia-ferramenta chat-ia-suave" data-ligado={ligado(estado.ferramenta !== "nada")}>
            <span>{consultando ? "Chamando o Ledgr" : "Usou o Ledgr"}</span>
            {consultando ? (
              <span className="chat-ia-pontos"><span /><span /><span /></span>
            ) : (
              <span> ›</span>
            )}
          </span>
          <Resposta estado={estado} className="chat-ia-resposta" />
          <div className="chat-ia-acoes chat-ia-suave" data-ligado={ligado(completa)}>
            <Icone d="M8 8h12v12H8zM16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" tamanho={16} />
            <Icone d="M7 10v10H4V10zM7 10l4-7a2 2 0 012 2v4h6a2 2 0 012 2.3l-1.3 7A2 2 0 0117.7 20H7" tamanho={16} />
          </div>
        </div>
        <div className="chat-ia-pilula">
          <div className="chat-ia-menu chat-ia-suave" data-ligado={ligado(estado.menuAberto)}>
            <span className="chat-ia-menu-titulo">Apps</span>
            <div className="chat-ia-menu-item chat-ia-menu-ledgr">
              <Ledgr altura={13} />
              <span>Ledgr</span>
            </div>
          </div>
          <span className="chat-ia-botao-redondo"><Icone d={MAIS} /></span>
          <span className="chat-ia-linha">
            <span className="chat-ia-mencao" data-ligado={ligado(estado.ledgrLigado && !enviada)}>Ledgr</span>
            <Campo estado={estado} placeholder="Pergunte alguma coisa" />
          </span>
          <Icone d="M9 6a3 3 0 016 0v5a3 3 0 01-6 0zM5 11a7 7 0 0014 0M12 18v3" />
          <span className="chat-ia-enviar chat-ia-enviar-gpt" data-ligado={ligado(estado.digitado !== "" && estado.digitado !== "@" && !enviada)}>
            <Icone d={ENVIAR} tamanho={15} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function JanelaDaIa({ ia, estado }: { ia: IaDaConexao; estado: EstadoDoChat }) {
  return ia === "chatgpt" ? <JanelaDoChatGpt estado={estado} /> : <JanelaDoClaude estado={estado} />;
}

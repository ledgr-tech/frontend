"use client";

import { useId, useState, type ReactNode } from "react";
import { enderecoExterno } from "@/lib/rotas";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import { revogarConexaoMcp, type ConexaoMcp } from "./acoes";

type Assistente = "chatgpt" | "claude";

// Os passos de cada assistente, pela documentação oficial de 11/11: no ChatGPT, o servidor entra pelos
// Plugins (em 29/10 era pelo Modo desenvolvedor, que a ajuda da Central guarda para contas antigas). Os
// menus são do ChatGPT e do Claude, não nossos: mudam sem aviso, e a nota embaixo leva à documentação de
// cada um. O Ledgr só aparece no passo 3, na tela /autorizar-conexao.
const PASSOS: Record<Assistente, ReactNode[]> = {
  chatgpt: [
    <>No ChatGPT, abra os <strong>Plugins</strong> (chatgpt.com/plugins), clique em <strong>+</strong> e escolha adicionar um servidor MCP personalizado.</>,
    <>Dê o nome <strong>Ledgr</strong>, cole o endereço do conector, escolha a autenticação <strong>OAuth</strong>, confirme o aviso e crie o plugin.</>,
    <>Quando o ChatGPT abrir o Ledgr, entre com a sua conta, escolha a empresa e clique em <strong>Autorizar</strong>.</>,
    <>Numa conversa, digite <strong>@</strong>, escolha o Ledgr e pergunte.</>,
  ],
  claude: [
    <>No Claude, abra <strong>Conectores</strong> e clique em <strong>Adicionar conector personalizado</strong>.</>,
    <>Dê o nome <strong>Ledgr</strong>, cole o endereço do conector e clique em <strong>Adicionar</strong>.</>,
    <>Clique em <strong>Conectar</strong>: o Claude abre o Ledgr. Entre com a sua conta, escolha a empresa e clique em <strong>Autorizar</strong>.</>,
    <>Numa conversa, clique em <strong>+</strong>, abra <strong>Conectores</strong>, ligue o Ledgr e pergunte.</>,
  ],
};

const NOME: Record<Assistente, string> = { chatgpt: "ChatGPT", claude: "Claude" };

// a ajuda oficial de quem desenha esses menus, para quando o caminho dos passos mudar
const DOCUMENTACAO: Record<Assistente, string> = {
  chatgpt: "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt",
  claude: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
};

// as perguntas que as ferramentas do backend (#136) respondem: resumo, divergências e fechamentos de um mês
const EXEMPLOS = [
  "Como está a conciliação de outubro?",
  "Quantas divergências ainda faltam revisar em setembro?",
  "Setembro já foi fechado? Teve ressalva?",
  "Compare as divergências de setembro e outubro.",
];

/**
 * Configurações › Conexões (front #195): ensina o que a conexão faz e como ligar no ChatGPT e no Claude, com o
 * endereço do conector para copiar, e lista as conexões da conta, cada uma de uma empresa, com revogar
 * confirmado na linha. Quem monta (e esconde a seção quando o backend está com a conexão desligada) são as
 * Configurações.
 */
export function PainelDeConexoes({ itens: iniciais, endereco }: { itens: ConexaoMcp[]; endereco: string | null }) {
  const [itens, setItens] = useState(iniciais);
  const [assistente, setAssistente] = useState<Assistente>("chatgpt");
  // o último texto copiado: o endereço ou o comando do Claude Code
  const [copiado, setCopiado] = useState<string | null>(null);
  const comando = endereco ? `claude mcp add --transport http ledgr ${endereco}` : null;

  async function copiar(texto: string | null) {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
    } catch {
      // sem permissão da área de transferência, o texto continua à vista para copiar à mão
    }
  }

  return (
    <div className="api-chaves conexao-guia">
      <section className="conexao-parte" aria-labelledby="conexao-como-funciona">
        <h4 id="conexao-como-funciona" className="conexao-parte-titulo">Como funciona</h4>
        <p className="conexao-texto">
          Você liga o Ledgr ao ChatGPT ou ao Claude uma vez. Depois, pergunta sobre os meses em português, e ele
          responde com os números da empresa que você escolheu. Por exemplo:
        </p>
        <ul className="conexao-exemplos">
          {EXEMPLOS.map((exemplo) => (
            <li key={exemplo}>{`“${exemplo}”`}</li>
          ))}
        </ul>
        <p className="conexao-texto conexao-texto-fraco">
          Ele lê o resumo de cada mês, as divergências (categoria, data, valor e situação) e os fechamentos. Nunca vê
          a descrição dos lançamentos, o texto das justificativas nem nomes de pessoas ou de arquivos. Só lê: não
          concilia, não justifica e não fecha mês. Cada conexão lê uma empresa, a conta tem até 10 ativas, e você
          revoga quando quiser.
        </p>
        <p className="conexao-texto conexao-texto-fraco">
          {"O que ele lê passa para a sua conta do ChatGPT ou do Claude e fica sob as regras dela, como as de guardar as conversas. Veja a "}
          <a href="/privacidade#conexao-ia" target="_blank" rel="noopener" className="link-animado">
            Política de privacidade
          </a>
          .
        </p>
      </section>

      <section className="conexao-parte" aria-labelledby="conexao-como-conectar">
        <h4 id="conexao-como-conectar" className="conexao-parte-titulo">Como conectar</h4>
        {endereco && (
          <div className="conexao-endereco">
            <span className="conexao-endereco-rotulo">Endereço do conector</span>
            <code>{endereco}</code>
            <button type="button" className="btn btn-secondary" onClick={() => copiar(endereco)}>
              {copiado === endereco ? <span className="rotulo-troca">Copiado</span> : "Copiar"}
            </button>
          </div>
        )}
        <div className="pills segmentado" role="group" aria-label="Assistente">
          <button type="button" className="pill" aria-pressed={assistente === "chatgpt"} onClick={() => setAssistente("chatgpt")}>
            ChatGPT
          </button>
          <button type="button" className="pill" aria-pressed={assistente === "claude"} onClick={() => setAssistente("claude")}>
            Claude
          </button>
        </div>
        <ol className="conexao-passos" aria-label={`Passos no ${NOME[assistente]}`}>
          {PASSOS[assistente].map((passo, i) => (
            <li key={i}>{passo}</li>
          ))}
        </ol>
        {assistente === "claude" && comando && (
          <details className="recolhivel">
            <summary className="recolhivel-titulo">
              <span className="conexao-texto">Usa o Claude Code, no terminal?</span>
            </summary>
            <div className="conexao-parte">
              <p className="conexao-texto">
                Rode o comando abaixo. Depois, no Claude Code, digite <code>/mcp</code>, escolha o Ledgr e entre pelo
                navegador. O Ledgr avisa que o pedido vem de um programa do seu computador: autorize só se foi você
                quem rodou o comando agora.
              </p>
              <div className="conexao-endereco">
                <span className="conexao-endereco-rotulo">Comando</span>
                <code>{comando}</code>
                <button type="button" className="btn btn-secondary" onClick={() => copiar(comando)}>
                  {copiado === comando ? <span className="rotulo-troca">Copiado</span> : "Copiar"}
                </button>
              </div>
            </div>
          </details>
        )}
        <p className="conexao-texto conexao-texto-fraco">
          {`Os nomes e o lugar dos menus são do ${NOME[assistente]} e mudam com o plano e com o tempo. Se não achar, siga a `}
          <a
            href={enderecoExterno(DOCUMENTACAO[assistente])}
            target="_blank"
            rel="noopener noreferrer"
            className="link-animado"
          >
            {`documentação do ${NOME[assistente]}`}
          </a>
          . Só o admin e o gestor autorizam conexões.
        </p>
        <p className="conexao-texto conexao-texto-fraco">
          {"Exemplos de perguntas e o que fazer quando a conexão não funciona estão na "}
          {/* em outra aba: as Configurações ficam abertas no passo em que a pessoa parou */}
          <a href="/ajuda/configuracoes#conexoes" target="_blank" rel="noopener" className="link-animado">
            Central de ajuda
          </a>
          .
        </p>
      </section>

      <section className="conexao-parte" aria-labelledby="conexao-suas">
        <h4 id="conexao-suas" className="conexao-parte-titulo">Suas conexões</h4>
        {itens.length === 0 ? (
          <p className="cfg-valor">Nenhuma conexão ainda. Siga os passos acima e ela aparece aqui.</p>
        ) : (
          <ul className="api-lista" aria-label="Conexões">
            {itens.map((conexao) => (
              <LinhaDaConexao
                key={conexao.id}
                conexao={conexao}
                onRevogada={(revogadaEm) =>
                  setItens((atuais) => atuais.map((item) => (item.id === conexao.id ? { ...item, revogadaEm } : item)))
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinhaDaConexao({ conexao, onRevogada }: { conexao: ConexaoMcp; onRevogada: (revogadaEm: string) => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idErro = useId();

  async function revogar() {
    setEnviando(true);
    setErro(null);
    let resposta: Awaited<ReturnType<typeof revogarConexaoMcp>>;
    try {
      resposta = await revogarConexaoMcp(conexao.id);
    } catch {
      resposta = { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
    }
    setEnviando(false);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    setConfirmando(false);
    onRevogada(new Date().toISOString());
  }

  return (
    <li className="api-chave">
      <div className="api-chave-texto">
        <span className="cfg-linha-titulo">
          {conexao.cliente}
          {conexao.revogadaEm && <span className="tag">Revogada</span>}
        </span>
        <span className="cfg-linha-descricao">{`Lê ${conexao.empresa.razaoSocial} · só leitura`}</span>
        <span className="cfg-linha-descricao">
          {[
            `Autorizada${conexao.criadaPor ? ` por ${conexao.criadaPor}` : ""} em ${formatarDataHora(conexao.criadoEm)}`,
            conexao.revogadaEm
              ? `revogada em ${formatarDataHora(conexao.revogadaEm)}`
              : conexao.ultimoUsoEm
                ? `último uso em ${formatarDataHora(conexao.ultimoUsoEm)}`
                : "ainda não usada",
          ].join(" · ")}
        </span>
        {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
      </div>
      {!conexao.revogadaEm &&
        (confirmando ? (
          <div className="cfg-form-botoes" role="group" aria-label={`Revogar ${conexao.cliente}`}>
            <span className="cfg-valor">{`O ${conexao.cliente} deixa de ler o Ledgr na hora.`}</span>
            <button type="button" className="btn btn-perigo" disabled={enviando} onClick={revogar}>
              {enviando ? "Revogando…" : "Revogar"}
            </button>
            <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmando(true)}>
            Revogar
          </button>
        ))}
    </li>
  );
}

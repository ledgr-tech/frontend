"use client";

import { useId, useState, type ReactNode } from "react";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import { revogarConexaoMcp, type ConexaoMcp } from "./acoes";

type Assistente = "chatgpt" | "claude";

// Os passos de cada assistente (29/10). Os menus são do ChatGPT e do Claude, não nossos: mudam sem
// aviso, e a nota embaixo diz isso. O Ledgr só aparece no passo 3, na tela /autorizar-conexao.
const PASSOS: Record<Assistente, ReactNode[]> = {
  chatgpt: [
    <>No ChatGPT, abra <strong>Configurações › Apps e conectores › Avançado</strong> e ligue o <strong>Modo desenvolvedor</strong>. Ele só existe nos planos pagos.</>,
    <>Volte a <strong>Apps e conectores</strong> e clique em <strong>Criar</strong>. Dê o nome <strong>Ledgr</strong>, cole o endereço do conector e escolha a autenticação <strong>OAuth</strong>.</>,
    <>O ChatGPT abre o Ledgr: entre com a sua conta, escolha a empresa e clique em <strong>Autorizar</strong>.</>,
    <>Numa conversa, ative o Ledgr nas ferramentas e pergunte.</>,
  ],
  claude: [
    <>No Claude, abra <strong>Configurações › Conectores</strong> e clique em <strong>Adicionar conector personalizado</strong>.</>,
    <>Dê o nome <strong>Ledgr</strong>, cole o endereço do conector e clique em <strong>Adicionar</strong>.</>,
    <>Clique em <strong>Conectar</strong>: o Claude abre o Ledgr. Entre com a sua conta, escolha a empresa e clique em <strong>Autorizar</strong>.</>,
    <>Numa conversa, ative o Ledgr no menu de ferramentas e pergunte.</>,
  ],
};

// as perguntas que as ferramentas do backend (#136) respondem: resumo, divergências e fechamentos de um mês
const EXEMPLOS = [
  "Como está a conciliação de outubro?",
  "Quantas divergências ainda faltam revisar em setembro?",
  "Setembro já foi fechado? Teve ressalva?",
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
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!endereco) return;
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
    } catch {
      // sem permissão da área de transferência, o endereço continua à vista para copiar à mão
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
          concilia, não justifica e não fecha mês. Cada conexão lê uma empresa, e você revoga quando quiser.
        </p>
      </section>

      <section className="conexao-parte" aria-labelledby="conexao-como-conectar">
        <h4 id="conexao-como-conectar" className="conexao-parte-titulo">Como conectar</h4>
        {endereco && (
          <div className="conexao-endereco">
            <span className="conexao-endereco-rotulo">Endereço do conector</span>
            <code>{endereco}</code>
            <button type="button" className="btn btn-secondary" onClick={copiar}>
              {copiado ? "Copiado" : "Copiar"}
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
        <ol className="conexao-passos" aria-label={`Passos no ${assistente === "chatgpt" ? "ChatGPT" : "Claude"}`}>
          {PASSOS[assistente].map((passo, i) => (
            <li key={i}>{passo}</li>
          ))}
        </ol>
        <p className="conexao-texto conexao-texto-fraco">
          Os nomes dos menus são do ChatGPT e do Claude e podem mudar. Só o admin e o gestor autorizam conexões.
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

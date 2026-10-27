"use client";

import { useId, useState } from "react";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import { revogarConexaoMcp, type ConexaoMcp } from "./acoes";

/**
 * Configurações › Conexões (front #195): o endereço do conector, para colar no ChatGPT ou no Claude, e as
 * conexões da conta, cada uma de uma empresa, com revogar confirmado na linha. Quem monta (e esconde a
 * seção quando o backend está com a conexão desligada) são as Configurações.
 */
export function PainelDeConexoes({ itens: iniciais, endereco }: { itens: ConexaoMcp[]; endereco: string | null }) {
  const [itens, setItens] = useState(iniciais);

  return (
    <div className="api-chaves">
      {endereco && (
        <p className="api-endereco">
          {"Endereço do conector: "}
          <code>{endereco}</code>
        </p>
      )}
      {itens.length === 0 ? (
        <p className="cfg-valor">Nenhuma conexão ainda.</p>
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

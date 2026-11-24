"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { IntegracaoSistema } from "@/lib/adaptadores";
import { useRoteador } from "@/lib/roteador";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import {
  carregarIntegracaoSistema,
  removerIntegracaoSistema,
  salvarIntegracaoSistema,
  type ResultadoIntegracao,
} from "./acoes";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "expirada" }
  | { situacao: "falhou"; erro: string }
  | { situacao: "pronto"; dados: IntegracaoSistema };

const NAO_CONFIGURADA: IntegracaoSistema = {
  configurada: false,
  adaptador: null,
  url: null,
  chavePrefixo: null,
  atualizadaEm: null,
  atualizadaPor: null,
};

function textoAtualizacao(dados: IntegracaoSistema): string | null {
  if (dados.atualizadaEm && dados.atualizadaPor) {
    return `Atualizada em ${formatarDataHora(dados.atualizadaEm)} por ${dados.atualizadaPor}.`;
  }
  if (dados.atualizadaEm) return `Atualizada em ${formatarDataHora(dados.atualizadaEm)}.`;
  if (dados.atualizadaPor) return `Atualizada por ${dados.atualizadaPor}.`;
  return null;
}

function prefixoFormatado(prefixo: string): string {
  return prefixo.endsWith("…") || prefixo.endsWith("...") ? prefixo : `${prefixo}…`;
}

/**
 * Configurações › Integração (backend #253): configura URL e chave do sistema de gestão da empresa
 * ativa. Só admin e gestor abrem esta seção (e só quando `integracao_sistema_habilitada` vem true).
 * A chave é campo de senha, nunca volta do backend e some do estado logo após salvar.
 */
export function PainelDeIntegracao() {
  const roteador = useRoteador();
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [url, setUrl] = useState("");
  const [chave, setChave] = useState("");
  const [erroUrl, setErroUrl] = useState<string | null>(null);
  const [erroChave, setErroChave] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroRemocao, setErroRemocao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const travado = useRef(false);
  const botaoRemover = useRef<HTMLButtonElement>(null);

  const idFalha = useId();
  const idUrl = useId();
  const idDicaUrl = useId();
  const idChave = useId();
  const idDicaChave = useId();
  const idErroUrl = useId();
  const idErroChave = useId();
  const idErroGeral = useId();
  const idErroRemocao = useId();

  useEffect(() => {
    let vivo = true;
    carregarIntegracaoSistema()
      .then((resposta) => {
        if (!vivo) return;
        if (!resposta.ok) {
          if (resposta.status === 401) {
            setEstado({ situacao: "expirada" });
            return;
          }
          setEstado({ situacao: "falhou", erro: resposta.erro });
          return;
        }
        setEstado({ situacao: "pronto", dados: resposta.dados });
        setUrl(resposta.dados.configurada ? (resposta.dados.url ?? "") : "");
        setChave("");
      })
      .catch(() => {
        if (vivo) setEstado({ situacao: "falhou", erro: SEM_SERVIDOR });
      });
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  const sessaoExpirada = estado.situacao === "expirada";
  useEffect(() => {
    if (sessaoExpirada) roteador.push("/login");
  }, [sessaoExpirada, roteador]);

  if (estado.situacao === "carregando" || estado.situacao === "expirada") {
    return (
      <p className="cfg-valor" aria-busy="true">
        Carregando a integração…
      </p>
    );
  }

  if (estado.situacao === "falhou") {
    return (
      <div className="api-chaves">
        <MensagemErro id={idFalha}>{estado.erro}</MensagemErro>
        <div className="cfg-form-botoes">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setEstado({ situacao: "carregando" });
              setTentativa((n) => n + 1);
            }}
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const { dados } = estado;
  const ocupado = salvando || removendo;
  const atualizacao = textoAtualizacao(dados);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (travado.current) return;
    setErroUrl(null);
    setErroChave(null);
    setErroGeral(null);
    setErroRemocao(null);
    setAviso(null);

    if (!url.trim()) {
      setErroUrl("Informe a URL do sistema de gestão.");
      return;
    }
    if (!chave.trim()) {
      setErroChave(
        dados.configurada
          ? "Cole a chave de acesso para salvar as alterações."
          : "Informe a chave de acesso do sistema de gestão.",
      );
      return;
    }

    travado.current = true;
    setSalvando(true);
    let resposta: ResultadoIntegracao<IntegracaoSistema>;
    try {
      resposta = await salvarIntegracaoSistema(url, chave);
    } catch {
      resposta = { ok: false, status: 0, erro: SEM_SERVIDOR };
    }
    travado.current = false;
    setSalvando(false);

    if (!resposta.ok) {
      if (resposta.status === 401) {
        roteador.push("/login");
        return;
      }
      if (resposta.campo === "url") setErroUrl(resposta.erro);
      else if (resposta.campo === "chave") setErroChave(resposta.erro);
      else setErroGeral(resposta.erro);
      return;
    }

    setEstado({ situacao: "pronto", dados: resposta.dados });
    setUrl(resposta.dados.url ?? "");
    // a chave não fica em estado depois de salva nem volta a aparecer na tela
    setChave("");
    setConfirmandoRemocao(false);
    setAviso("Integração salva.");
    roteador.refresh();
  }

  async function remover() {
    if (travado.current) return;
    travado.current = true;
    setRemovendo(true);
    setErroRemocao(null);
    setAviso(null);
    let resposta: Awaited<ReturnType<typeof removerIntegracaoSistema>>;
    try {
      resposta = await removerIntegracaoSistema();
    } catch {
      resposta = { ok: false, status: 0, erro: SEM_SERVIDOR };
    }
    travado.current = false;
    setRemovendo(false);

    if (!resposta.ok) {
      if (resposta.status === 401) {
        roteador.push("/login");
        return;
      }
      setErroRemocao(resposta.erro);
      return;
    }

    setConfirmandoRemocao(false);
    setEstado({ situacao: "pronto", dados: NAO_CONFIGURADA });
    setUrl("");
    setChave("");
    setErroUrl(null);
    setErroChave(null);
    setErroGeral(null);
    setErroRemocao(null);
    setAviso("Integração removida.");
    roteador.refresh();
  }

  return (
    <div className="api-chaves">
      {dados.configurada ? (
        <div className="integracao-resumo" aria-label="Integração atual">
          <div className="integracao-resumo-topo">
            <span className="cfg-linha-titulo">Integração com o sistema</span>
            <span className="tag">Configurada</span>
          </div>
          {dados.url && (
            <p className="api-endereco">
              {"URL: "}
              <code>{dados.url}</code>
            </p>
          )}
          <p className="cfg-linha-descricao">
            {"Chave: "}
            {dados.chavePrefixo ? <code>{prefixoFormatado(dados.chavePrefixo)}</code> : "salva"}
          </p>
          {atualizacao && <p className="cfg-linha-descricao">{atualizacao}</p>}
        </div>
      ) : (
        <p className="cfg-valor">Nenhuma integração configurada para esta empresa.</p>
      )}

      <form className="cfg-form" onSubmit={salvar} noValidate autoComplete="off" aria-label="Configuração da integração">
        <div className="field">
          <label htmlFor={idUrl}>URL do sistema</label>
          <input
            id={idUrl}
            name="integracao_url"
            className="input"
            type="url"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            spellCheck={false}
            placeholder="https://sistema.suaempresa.com.br"
            value={url}
            disabled={ocupado}
            aria-invalid={erroUrl ? true : undefined}
            aria-describedby={[idDicaUrl, erroUrl ? idErroUrl : null].filter(Boolean).join(" ")}
            onChange={(evento) => {
              setUrl(evento.target.value);
              setErroUrl(null);
              setErroGeral(null);
              setAviso(null);
            }}
          />
          <p id={idDicaUrl} className="integracao-dica">
            Endereço base do sistema de gestão, sem incluir o caminho do extrato.
          </p>
          {erroUrl && <MensagemErro id={idErroUrl}>{erroUrl}</MensagemErro>}
        </div>

        <div className="field">
          <label htmlFor={idChave}>Chave de acesso</label>
          <input
            id={idChave}
            name="integracao_chave"
            className="input"
            type="password"
            // Chrome ignora autoComplete="off" em campos password e preenche e-mail/senha salvos do Ledgr
            // nos campos de URL e chave; one-time-code impede preenchimento automático e sugestão de senha
            autoComplete="one-time-code"
            data-1p-ignore="true"
            data-lpignore="true"
            spellCheck={false}
            placeholder={dados.configurada ? "Cole uma chave nova para trocar" : "Cole a chave emitida pelo sistema"}
            value={chave}
            disabled={ocupado}
            aria-invalid={erroChave ? true : undefined}
            aria-describedby={[dados.configurada ? idDicaChave : null, erroChave ? idErroChave : null].filter(Boolean).join(" ") || undefined}
            onChange={(evento) => {
              setChave(evento.target.value);
              setErroChave(null);
              setErroGeral(null);
              setAviso(null);
            }}
          />
          {dados.configurada && (
            <p id={idDicaChave} className="integracao-dica">
              Cole uma chave nova para trocar. Alterar a URL também exige colar a chave de novo.
            </p>
          )}
          {erroChave && <MensagemErro id={idErroChave}>{erroChave}</MensagemErro>}
        </div>

        {erroGeral && <MensagemErro id={idErroGeral}>{erroGeral}</MensagemErro>}
        {aviso && (
          <p className="cfg-feito" role="status">
            {aviso}
          </p>
        )}

        <div className="cfg-form-botoes">
          <button type="submit" className="btn btn-primary" disabled={ocupado}>
            {salvando ? "Salvando…" : "Salvar integração"}
          </button>
        </div>
      </form>

      {dados.configurada && (
        <div className="integracao-remover">
          {confirmandoRemocao ? (
            <div className="cfg-form" role="group" aria-label="Confirmar remoção da integração">
              <p className="cfg-form-aviso">
                Esta empresa deixará de importar o extrato direto do sistema de gestão até você configurar de novo.
              </p>
              {erroRemocao && <MensagemErro id={idErroRemocao}>{erroRemocao}</MensagemErro>}
              <div className="cfg-form-botoes">
                <button type="button" className="btn btn-perigo" disabled={ocupado} onClick={() => void remover()}>
                  {removendo ? "Removendo…" : "Remover de vez"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  autoFocus
                  disabled={ocupado}
                  onClick={() => {
                    setConfirmandoRemocao(false);
                    setErroRemocao(null);
                    requestAnimationFrame(() => botaoRemover.current?.focus());
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={botaoRemover}
              type="button"
              className="btn btn-secondary"
              disabled={ocupado}
              onClick={() => {
                setConfirmandoRemocao(true);
                setErroRemocao(null);
                setAviso(null);
              }}
            >
              Remover integração
            </button>
          )}
        </div>
      )}
    </div>
  );
}

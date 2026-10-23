"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useEmpresaAtiva, useEmpresasDaConta } from "@/lib/empresa-ativa";
import { enderecoExterno } from "@/lib/rotas";
import { MensagemErro } from "../../../../(auth)/_compartilhado/mensagem-erro";
import { formatarDataHora } from "../dashboard/resumo";
import { carregarChavesApi, criarChaveApi, revogarChaveApi, type ChaveApi, type ChavesDaApi } from "./acoes";

type Estado =
  | { situacao: "carregando" }
  | { situacao: "falhou"; erro: string }
  | { situacao: "sem-rota" }
  | { situacao: "pronto"; dados: ChavesDaApi };

const FALHA_DE_REDE = "Não foi possível falar com o servidor.";

/**
 * Configurações › API (front #194): as chaves da API pública, só de leitura. Criar mostra o token uma
 * vez, com o aviso de copiar; revogar pede confirmação na própria linha. Só o admin e o gestor chegam
 * aqui (a seção some para o analista).
 */
export function PainelDeChavesApi() {
  const [estado, setEstado] = useState<Estado>({ situacao: "carregando" });
  // o token da chave recém-criada: some ao sair da seção, e o backend não o devolve de novo
  const [tokenNovo, setTokenNovo] = useState<{ nome: string; token: string } | null>(null);
  const idFalha = useId();

  useEffect(() => {
    let vivo = true;
    carregarChavesApi()
      .then((resposta) => {
        if (!vivo) return;
        if (resposta.ok) setEstado({ situacao: "pronto", dados: resposta.dados });
        else if (resposta.status === 404) setEstado({ situacao: "sem-rota" });
        else setEstado({ situacao: "falhou", erro: resposta.erro });
      })
      .catch(() => vivo && setEstado({ situacao: "falhou", erro: FALHA_DE_REDE }));
    return () => {
      vivo = false;
    };
  }, []);

  if (estado.situacao === "carregando") return <p className="cfg-valor" aria-busy="true">Carregando as chaves…</p>;
  if (estado.situacao === "sem-rota") return <p className="cfg-valor">A API pública ainda não está disponível nesta conta.</p>;
  if (estado.situacao === "falhou") return <MensagemErro id={idFalha}>{estado.erro}</MensagemErro>;

  const { itens, endereco } = estado.dados;
  const ativas = itens.filter((chave) => !chave.revogadaEm).length;

  function trocar(itensNovos: ChaveApi[]) {
    setEstado({ situacao: "pronto", dados: { endereco, itens: itensNovos } });
  }

  return (
    <div className="api-chaves">
      {endereco && (
        <p className="api-endereco">
          {"Endereço: "}
          <code>{`${endereco}/v1`}</code>
          {" · Documentação: "}
          <a href={enderecoExterno(`${endereco}/v1/openapi.json`)} target="_blank" rel="noreferrer" className="cfg-link">
            OpenAPI
          </a>
          {" e "}
          <a href={enderecoExterno(`${endereco}/llms.txt`)} target="_blank" rel="noreferrer" className="cfg-link">
            llms.txt
          </a>
        </p>
      )}

      {tokenNovo && <TokenNovo {...tokenNovo} onFechar={() => setTokenNovo(null)} />}

      <CriarChave
        // o backend aceita no máximo 10 ativas por conta (409); a tela já avisa antes
        limiteAtingido={ativas >= 10}
        onCriada={(chave, token) => {
          trocar([chave, ...itens]);
          setTokenNovo({ nome: chave.nome, token });
        }}
      />

      {itens.length === 0 ? (
        <p className="cfg-valor">Nenhuma chave criada ainda.</p>
      ) : (
        <ul className="api-lista" aria-label="Chaves da API">
          {itens.map((chave) => (
            <LinhaDaChave
              key={chave.id}
              chave={chave}
              onRevogada={(revogadaEm) =>
                trocar(itens.map((item) => (item.id === chave.id ? { ...item, revogadaEm } : item)))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TokenNovo({ nome, token, onFechar }: { nome: string; token: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState<"sim" | "manual" | null>(null);
  const valor = useRef<HTMLElement>(null);
  const idAviso = useId();

  async function copiar() {
    try {
      await navigator.clipboard.writeText(token);
      setCopiado("sim");
    } catch {
      // sem permissão de área de transferência: o token fica selecionado para o Ctrl+C
      const selecao = window.getSelection();
      if (valor.current && selecao) {
        selecao.selectAllChildren(valor.current);
        setCopiado("manual");
      }
    }
  }

  return (
    <div className="api-token" role="status" aria-describedby={idAviso}>
      <strong>{`Chave “${nome}” criada`}</strong>
      <p id={idAviso} className="cfg-form-aviso">
        Copie agora e guarde num lugar seguro: o Ledgr não mostra esta chave de novo. Quem tiver a chave lê os dados
        que ela alcança.
      </p>
      <code ref={valor} className="api-token-valor">
        {token}
      </code>
      {copiado === "manual" && <p className="cfg-linha-descricao">O navegador não deixou copiar: a chave está selecionada, use Ctrl+C.</p>}
      <div className="cfg-form-botoes">
        <button type="button" className="btn btn-primary" onClick={copiar}>
          {copiado === "sim" ? "Copiada" : "Copiar chave"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onFechar}>
          Já guardei
        </button>
      </div>
    </div>
  );
}

function CriarChave({
  limiteAtingido,
  onCriada,
}: {
  limiteAtingido: boolean;
  onCriada: (chave: ChaveApi, token: string) => void;
}) {
  const empresas = useEmpresasDaConta();
  const ativa = useEmpresaAtiva();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  // a menor permissão primeiro: a empresa ativa, e "todas" só se a pessoa escolher
  const [escopo, setEscopo] = useState<string>(ativa?.id ?? "conta");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const travado = useRef(false);
  const idNome = useId();
  const idEscopo = useId();
  const idErro = useId();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (travado.current) return;
    if (!nome.trim()) {
      setErro("Dê um nome à chave, como o sistema que vai usá-la.");
      return;
    }
    travado.current = true;
    setEnviando(true);
    setErro(null);
    let resposta: Awaited<ReturnType<typeof criarChaveApi>>;
    try {
      resposta = await criarChaveApi(nome, escopo === "conta" ? null : escopo);
    } catch {
      resposta = { ok: false, status: 0, erro: FALHA_DE_REDE };
    }
    travado.current = false;
    setEnviando(false);
    if (!resposta.ok) {
      setErro(resposta.erro);
      return;
    }
    setAberto(false);
    setNome("");
    onCriada(resposta.dados.chave, resposta.dados.token);
  }

  if (!aberto) {
    return (
      <div className="cfg-acao">
        {limiteAtingido && <span className="cfg-valor">A conta já tem 10 chaves ativas. Revogue uma para criar outra.</span>}
        <button type="button" className="btn btn-secondary" disabled={limiteAtingido} onClick={() => setAberto(true)}>
          Criar chave
        </button>
      </div>
    );
  }

  return (
    <form className="cfg-form" onSubmit={enviar} noValidate aria-label="Criar chave">
      <div className="field">
        <label htmlFor={idNome}>Nome</label>
        <input
          id={idNome}
          className="input"
          maxLength={60}
          autoFocus
          placeholder="Ex.: Planilha do financeiro"
          value={nome}
          disabled={enviando}
          aria-describedby={erro ? idErro : undefined}
          onChange={(evento) => setNome(evento.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={idEscopo}>Empresas que a chave lê</label>
        <select
          id={idEscopo}
          className="input"
          value={escopo}
          disabled={enviando}
          onChange={(evento) => setEscopo(evento.target.value)}
        >
          {empresas.map((empresa) => (
            <option key={empresa.id} value={empresa.id}>
              {empresa.razaoSocial}
            </option>
          ))}
          <option value="conta">Todas as empresas da conta</option>
        </select>
      </div>
      <p className="cfg-linha-descricao">Só leitura: a chave consulta conciliações, divergências e fechamentos, sem descrição de lançamento nem justificativas.</p>
      {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
      <div className="cfg-form-botoes">
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? "Criando…" : "Criar chave"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={enviando} onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function LinhaDaChave({ chave, onRevogada }: { chave: ChaveApi; onRevogada: (revogadaEm: string) => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idErro = useId();

  async function revogar() {
    setEnviando(true);
    setErro(null);
    let resposta: Awaited<ReturnType<typeof revogarChaveApi>>;
    try {
      resposta = await revogarChaveApi(chave.id);
    } catch {
      resposta = { ok: false, status: 0, erro: FALHA_DE_REDE };
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
    <li className="api-chave" data-revogada={chave.revogadaEm ? "true" : undefined}>
      <div className="api-chave-texto">
        <span className="cfg-linha-titulo">
          {chave.nome}
          {chave.revogadaEm && <span className="tag">Revogada</span>}
        </span>
        <span className="cfg-linha-descricao">
          <code>{`ledgr_${chave.prefixo}…`}</code>
          {` · ${chave.empresa ? chave.empresa.razaoSocial : "Todas as empresas da conta"}`}
        </span>
        <span className="cfg-linha-descricao">
          {[
            `Criada${chave.criadaPor ? ` por ${chave.criadaPor}` : ""} em ${formatarDataHora(chave.criadoEm)}`,
            chave.revogadaEm
              ? `revogada em ${formatarDataHora(chave.revogadaEm)}`
              : chave.ultimoUsoEm
                ? `último uso em ${formatarDataHora(chave.ultimoUsoEm)}`
                : "nunca usada",
          ].join(" · ")}
        </span>
        {erro && <MensagemErro id={idErro}>{erro}</MensagemErro>}
      </div>
      {!chave.revogadaEm &&
        (confirmando ? (
          <div className="cfg-form-botoes" role="group" aria-label={`Revogar ${chave.nome}`}>
            <span className="cfg-valor">Quem usa esta chave perde o acesso na hora.</span>
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

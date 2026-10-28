"use client";

import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Check, Copy, FileUp, ShieldCheck } from "lucide-react";
import { useRoteador } from "@/lib/roteador";
import { MensagemErro } from "../../../../../../(auth)/_compartilhado/mensagem-erro";
import { importarViaIa, type ErroDeCampo, type PromptDaIa } from "./acoes";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const estiloTituloDoCartao: CSSProperties = { margin: 0, fontSize: 20, fontWeight: 600 };

function tamanho(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * O passo a passo da importação via IA (#224), no padrão da Nova conciliação (opção B do 28/10): cartão
 * "Como importar" com três passos, o prompt com "Copiar prompt" e o cartão de arrastar arquivo. Erro de
 * validação aparece numa tabela (o backend manda até 50, sem eco da descrição) e o passo a passo recolhe.
 * Importação válida segue para a revisão, e nada entra no sistema antes de a pessoa confirmar.
 */
export function ImportarViaIa({ prompt }: { prompt: PromptDaIa }) {
  const roteador = useRoteador();
  const [copiado, setCopiado] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<ErroDeCampo[]>([]);
  const trava = useRef(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopiado(true);
    } catch {
      setErro("Não foi possível copiar. Selecione o texto do prompt e copie à mão.");
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!arquivo || trava.current) return;
    if (arquivo.size > TAMANHO_MAXIMO) return setErro("O arquivo passa de 5 MB.");
    trava.current = true;
    setEnviando(true);
    setErro(null);
    setErros([]);
    try {
      const dados = new FormData();
      dados.append("arquivo", arquivo);
      const r = await importarViaIa(dados);
      if (!r.ok) {
        setErro(r.erro);
        setErros(r.erros);
        return;
      }
      roteador.push(`/conciliacoes/nova/ia/${r.dados.importacaoId}`);
    } catch {
      setErro("Não foi possível falar com o servidor.");
    } finally {
      trava.current = false;
      setEnviando(false);
    }
  }

  const comErros = erros.length > 0;
  const passos = (
    <>
      <section className="card nova-como-funciona" aria-labelledby="ia-como">
        <h2 id="ia-como" className="font-titulo nova-como-titulo">
          Como importar
        </h2>
        <p className="nova-como-subtitulo">Três passos, e a conferência final é sua.</p>
        <ol className="nova-passos">
          <li>
            <span className="nova-passo-numero" aria-hidden="true">
              1
            </span>
            <strong>Copie o prompt</strong>
            <span>É o texto que ensina a IA a devolver o arquivo no formato do Ledgr.</span>
          </li>
          <li>
            <span className="nova-passo-numero" aria-hidden="true">
              2
            </span>
            <strong>Use na IA que você já tem</strong>
            <span>Cole o prompt no ChatGPT, no Claude ou em outra, e anexe o PDF do relatório.</span>
          </li>
          <li>
            <span className="nova-passo-numero" aria-hidden="true">
              3
            </span>
            <strong>Traga o arquivo e confira</strong>
            <span>Envie o JSON que ela devolveu e revise as linhas antes de confirmar.</span>
          </li>
        </ol>
        <div className="nova-notas">
          <p className="nova-nota nova-nota-destaque">
            <ShieldCheck aria-hidden="true" />
            <span>O Ledgr não usa nenhuma IA: ele só recebe o arquivo que você traz. Nada entra no sistema antes de você confirmar.</span>
          </p>
        </div>
      </section>

      <section className="card" style={{ padding: 20, display: "grid", gap: 12 }} aria-labelledby="ia-prompt">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 id="ia-prompt" className="font-titulo" style={estiloTituloDoCartao}>
            Prompt para a IA
          </h2>
          <button type="button" className="btn btn-secondary" onClick={copiar}>
            <Copy size={16} aria-hidden="true" />
            {copiado ? "Prompt copiado" : "Copiar prompt"}
          </button>
        </div>
        <pre
          tabIndex={0}
          aria-label="Prompt para a IA"
          style={{
            margin: 0,
            maxHeight: 170,
            overflow: "auto",
            padding: 14,
            borderRadius: 10,
            background: "color-mix(in srgb, var(--color-text) 5%, transparent)",
            font: "12.5px/1.6 ui-monospace, Consolas, monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {prompt.prompt}
        </pre>
      </section>
    </>
  );

  return (
    <form onSubmit={enviar} style={{ display: "grid", gap: 20, maxWidth: 880 }}>
      {comErros ? (
        <details className="card" style={{ padding: "14px 20px" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver o passo a passo e o prompt</summary>
          <div style={{ display: "grid", gap: 20, marginTop: 16 }}>{passos}</div>
        </details>
      ) : (
        passos
      )}

      <label className="card cartao-arquivo" data-pronto={arquivo ? "" : undefined}>
        <span className="cartao-arquivo-icone" aria-hidden="true">
          {arquivo ? <Check /> : <FileUp />}
        </span>
        <span className="font-titulo cartao-arquivo-titulo">Arquivo que a IA devolveu</span>
        {arquivo ? (
          <>
            <span className="cartao-arquivo-nome">{arquivo.name}</span>
            <span className="cartao-arquivo-meta">
              <span>{tamanho(arquivo.size)}</span> · <span className="cartao-arquivo-trocar">Trocar arquivo</span>
            </span>
          </>
        ) : (
          <>
            <span className="cartao-arquivo-dica">JSON ou TXT, até 5 MB</span>
            <span className="cartao-arquivo-acao">Arraste o arquivo ou clique para escolher</span>
          </>
        )}
        <input
          className="cartao-arquivo-input"
          type="file"
          accept=".json,.txt"
          aria-label="Arquivo da IA"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setErro(null);
            setErros([]);
          }}
        />
      </label>

      {erro && !comErros && <MensagemErro id="erro-importacao-ia">{erro}</MensagemErro>}
      {comErros && (
        <section className="card" style={{ padding: 20, display: "grid", gap: 12 }} aria-labelledby="ia-erros" role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="selo selo-risco">{`${erros.length} ${erros.length === 1 ? "erro" : "erros"}`}</span>
            <h2 id="ia-erros" className="font-titulo" style={estiloTituloDoCartao}>
              {erro}
            </h2>
          </div>
          <p style={{ margin: 0 }}>Corrija os pontos abaixo no arquivo, ou peça à IA para refazer a resposta, e envie de novo.</p>
          <table className="table" aria-label="Erros do arquivo">
            <thead>
              <tr>
                <th scope="col">Lançamento</th>
                <th scope="col">Campo</th>
                <th scope="col">O que corrigir</th>
              </tr>
            </thead>
            <tbody>
              {erros.map((e, i) => (
                <tr key={i}>
                  <td>{e.lancamento ?? "—"}</td>
                  <td>{e.caminho || "arquivo"}</td>
                  <td>{e.mensagem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div>
        <button type="submit" className="btn btn-primary" disabled={!arquivo || enviando}>
          {enviando ? "Lendo o arquivo…" : "Importar e conferir"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRoteador } from "@/lib/roteador";
import { MensagemErro } from "../../../../../../(auth)/_compartilhado/mensagem-erro";
import { importarViaIa, type ErroDeCampo, type PromptDaIa } from "./acoes";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/**
 * O passo a passo da importação via IA (#224): copiar o prompt, colar com o PDF na IA, trazer o arquivo que
 * ela devolve. Erro de validação aparece campo a campo (o backend manda até 50), sem eco da descrição.
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

  return (
    <div style={{ display: "grid", gap: 24, maxWidth: 760 }}>
      <ol style={{ display: "grid", gap: 8, paddingLeft: 20 }}>
        <li>Copie o prompt abaixo.</li>
        <li>Abra a IA que você já usa (ChatGPT, Claude…), cole o prompt e anexe o PDF do relatório de lançamentos.</li>
        <li>Salve o que a IA devolver em um arquivo <strong>.json</strong> (ou <strong>.txt</strong>) e envie aqui.</li>
        <li>Confira as linhas na próxima tela: a IA pode errar, e só depois de você confirmar elas entram no Ledgr.</li>
      </ol>

      <section aria-labelledby="ia-prompt">
        <h2 id="ia-prompt">Prompt</h2>
        <textarea className="input" readOnly value={prompt.prompt} rows={10} aria-label="Prompt para a IA" style={{ width: "100%", fontFamily: "monospace" }} />
        <button type="button" className="btn btn-secondary" onClick={copiar} style={{ marginTop: 8 }}>
          {copiado ? "Prompt copiado" : "Copiar prompt"}
        </button>
      </section>

      <form onSubmit={enviar} aria-labelledby="ia-envio" style={{ display: "grid", gap: 8 }}>
        <h2 id="ia-envio">Arquivo que a IA devolveu</h2>
        <input
          type="file"
          accept=".json,.txt"
          aria-label="Arquivo da IA"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setErro(null);
            setErros([]);
          }}
        />
        {erro && <MensagemErro id="erro-importacao-ia">{erro}</MensagemErro>}
        {erros.length > 0 && (
          <ul aria-label="Erros do arquivo">
            {erros.map((e, i) => (
              <li key={i}>{`${e.lancamento ? `Lançamento ${e.lancamento}` : "Arquivo"}${e.caminho ? ` · ${e.caminho}` : ""}: ${e.mensagem}`}</li>
            ))}
          </ul>
        )}
        <div>
          <button type="submit" className="btn btn-primary" disabled={!arquivo || enviando}>
            {enviando ? "Lendo o arquivo…" : "Importar e conferir"}
          </button>
        </div>
      </form>
    </div>
  );
}

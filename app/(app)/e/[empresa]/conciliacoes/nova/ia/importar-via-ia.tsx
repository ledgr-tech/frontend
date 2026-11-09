"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, FileJson, ShieldCheck } from "lucide-react";
import { useRoteador } from "@/lib/roteador";
import { ARQUIVO_GRANDE_DEMAIS, TAMANHO_MAXIMO_UPLOAD_BYTES } from "@/lib/limite-de-upload";
import { MensagemErro } from "../../../../../../(auth)/_compartilhado/mensagem-erro";
import { ErrosImportacaoIa } from "./erros-importacao-ia";
import { PromptIa } from "./prompt-ia";
import { Guia, type Passo } from "../guia";
import { importarViaIa, type ErroDeCampo, type PromptDaIa } from "./acoes";

const PASSOS: Passo[] = [
  { titulo: "Copie o prompt", texto: "É o texto que ensina a IA a devolver o arquivo no formato do Ledgr." },
  { titulo: "Use na IA que você já tem", texto: "Cole o prompt no ChatGPT, no Claude ou em outra, e anexe o PDF do relatório." },
  { titulo: "Traga o arquivo e confira", texto: "Envie o JSON que ela devolveu e revise as linhas antes de confirmar." },
];

function tamanho(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * O passo a passo da importação via IA (#224), no molde da Nova conciliação (versão D, 30/10): à
 * esquerda o prompt com "Copiar prompt", o arquivo que a IA devolveu numa folha em pé do sistema e,
 * quando o arquivo não passa, a tabela de erros (o backend manda até 50, sem eco da descrição); à
 * direita o painel com os três passos, que ganham o ✓ conforme a pessoa avança, e o "Importar e
 * conferir". Importação válida segue para a revisão, e nada entra no sistema antes de a pessoa confirmar.
 */
export function ImportarViaIa({ prompt }: { prompt: PromptDaIa }) {
  const roteador = useRoteador();
  const [copiado, setCopiado] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erros, setErros] = useState<ErroDeCampo[]>([]);
  // a lista para em 50: sem o total, quem corrige esses acha que acabou
  const [totalErros, setTotalErros] = useState(0);
  const trava = useRef(false);
  // o limite vale já na escolha: o arquivo aparece, mas o botão não liga e o motivo fica ao lado dele
  const grandeDemais = arquivo !== null && arquivo.size > TAMANHO_MAXIMO_UPLOAD_BYTES;

  function escolher(escolhido: File | null) {
    setArquivo(escolhido);
    setErro(null);
    setErros([]);
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!arquivo || grandeDemais || trava.current) return;
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
        setTotalErros(r.totalErros);
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
  // o recado mais novo vence o do tamanho: soltar um PDF por cima do arquivo grande diz por que o PDF não serve
  const aviso = comErros ? null : (erro ?? (grandeDemais ? ARQUIVO_GRANDE_DEMAIS : null));
  const titulo =
    comErros || grandeDemais ? "O arquivo tem problemas" : arquivo ? "Pronto para conferir" : copiado ? "Agora, a IA" : "Comece pelo prompt";

  return (
    <form onSubmit={enviar} className="nova-corpo conc-mesa">
      <div className="nova-coluna">
        <PromptIa prompt={prompt.prompt} onCopiado={() => setCopiado(true)} />

        {/* a folha do sistema em pé, com a do banco atrás: o arquivo da IA vira o extrato do sistema */}
        <label
          className="ia-folha"
          data-pronto={arquivo && !grandeDemais ? "" : undefined}
          data-arrastando={arrastando ? "" : undefined}
          onDragOver={(event) => {
            event.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setArrastando(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setArrastando(false);
            const solto = event.dataTransfer.files[0];
            if (!solto) return;
            if (!/\.(json|txt)$/i.test(solto.name)) return setErro("O arquivo da IA precisa ser JSON ou TXT.");
            escolher(solto);
          }}
        >
          <span className="rotulo nova-folha-rotulo">
            <span className="nova-folha-icone">{arquivo && !grandeDemais ? <Check aria-hidden="true" /> : <FileJson aria-hidden="true" />}</span>
            Arquivo que a IA devolveu
          </span>
          <strong className="nova-folha-titulo">{arquivo ? arquivo.name : "Solte aqui o JSON da IA"}</strong>
          {arquivo ? (
            <span className="nova-folha-dica">
              <span>{tamanho(arquivo.size)}</span> · <span className="nova-folha-trocar">Trocar arquivo</span>
            </span>
          ) : (
            <span className="nova-folha-dica">JSON ou TXT, até 4 MB. Solte aqui ou clique para escolher.</span>
          )}
          {arquivo && (
            <span className="ia-json" aria-hidden="true">
              {[40, 86, 78, 90, 70, 82].map((largura, i) => (
                <i key={i} style={{ width: `${largura}%` }} />
              ))}
            </span>
          )}
          <input
            className="nova-folha-input"
            type="file"
            accept=".json,.txt"
            aria-label="Arquivo da IA"
            onChange={(e) => {
              // cancelar a janela de escolha não apaga o arquivo que já estava
              const escolhido = e.target.files?.[0];
              if (escolhido) escolher(escolhido);
            }}
          />
        </label>

        {comErros && erro && <ErrosImportacaoIa erro={erro} erros={erros} totalErros={totalErros} />}
      </div>

      <aside className="conc-previa" aria-label="Importação via IA">
        <span className="rotulo">Nova conciliação · relatório de lançamentos</span>
        <h2 className="conc-previa-titulo" aria-live="polite">
          {titulo}
        </h2>
        <Guia
          titulo="Como importar"
          subtitulo="A conferência final é sua"
          passos={PASSOS}
          feitos={[copiado, copiado && arquivo !== null, arquivo !== null && !comErros && !grandeDemais]}
        />
        <dl className="conc-previa-dados">
          <dt>Formato</dt>
          <dd>JSON ou TXT, até 4 MB</dd>
          <dt>Extrato do banco</dt>
          <dd>Continua em OFX ou CSV</dd>
          <dt>Depois</dt>
          <dd>Você confere as linhas num rascunho antes de confirmar</dd>
        </dl>
        <div className="conc-previa-acoes">
          <button
            type="submit"
            className="btn nova-conciliar"
            disabled={!arquivo || grandeDemais || enviando}
            aria-describedby={aviso ? "erro-importacao-ia" : undefined}
          >
            {enviando ? "Lendo o arquivo…" : "Importar e conferir"}
            {!enviando && <ArrowRight aria-hidden="true" />}
          </button>
        </div>
        {/* embaixo do botão, no painel preso ao topo: debaixo do cartão do arquivo, o aviso caía fora da janela */}
        {aviso && <MensagemErro id="erro-importacao-ia">{aviso}</MensagemErro>}
        <p className="nova-nota">
          <ShieldCheck aria-hidden="true" />
          <span>O Ledgr não usa nenhuma IA: ele só recebe o arquivo que você traz. Nada entra no sistema antes de você confirmar.</span>
        </p>
      </aside>
    </form>
  );
}

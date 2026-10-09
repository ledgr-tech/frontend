"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileUp, Link2, Scale, ShieldCheck } from "lucide-react";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { conciliar, type Falha } from "../acoes";
import {
  aguardarProcessamento,
  conferirCsv,
  ERRO_SEM_RESPOSTA,
  motivoDaRecusa,
  RECADO,
  subir,
  TAMANHO_MAXIMO_BYTES,
  type Etapa,
  type Origem,
  type Pendente,
} from "../envio";
import { ImportacaoInterrompida } from "./importacao-interrompida";
import { Reveal } from "@/app/reveal";
import { Cabecalho } from "../../cabecalho";

export default function NovaConciliacaoPage() {
  const router = useRouter();
  const [arquivoBanco, setArquivoBanco] = useState<File | null>(null);
  const [arquivoSistema, setArquivoSistema] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  // para o laço de consulta se a pessoa sair da tela no meio do processamento
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  function escolher(origem: Origem, arquivo: File) {
    setErro(null);
    if (origem === "banco") setArquivoBanco(arquivo);
    else setArquivoSistema(arquivo);
  }

  function falhar(falha: Falha) {
    // 401 é sessão expirada: de volta pro login, em vez de um erro na tela
    if (falha.status === 401) {
      router.push("/login");
      return;
    }
    setEtapa("ocioso");
    setErro(falha.erro);
  }

  /**
   * O CSV passa pelas regras do backend antes de subir. Devolve true se pode
   * subir como está; senão abre a importação interrompida ou mostra o erro.
   */
  async function conferir(arquivo: File, origem: Origem): Promise<boolean> {
    const conferido = await conferirCsv(arquivo, origem);
    if (conferido.pronto) return true;
    if ("erro" in conferido) setErro(conferido.erro);
    else setPendente(conferido.pendente);
    return false;
  }

  async function conciliarExtratos(banco = arquivoBanco, sistema = arquivoSistema) {
    if (!banco || !sistema) return;

    const grande = [banco, sistema].find((arquivo) => arquivo.size > TAMANHO_MAXIMO_BYTES);
    if (grande) {
      // sem isso, o arquivo inteiro sobe só pra requisição ser recusada no caminho
      setErro(`O arquivo "${grande.name}" passa de 4MB. Exporte um período menor.`);
      return;
    }

    setErro(null);
    setAvisos([]);
    setEtapa("conferindo");

    try {
      // nada sobe antes de os dois estarem prontos: extrato órfão no backend não tem volta
      if (!(await conferir(banco, "banco")) || !(await conferir(sistema, "sistema"))) {
        setEtapa("ocioso");
        return;
      }
      setEtapa("enviando");
      await enviarEConciliar(banco, sistema);
    } catch {
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    }
  }

  /** Mapeamento confirmado: troca o arquivo pelo reescrito e continua de onde parou. */
  function retomar(reescrito: File) {
    if (!pendente) return;
    const banco = pendente.origem === "banco" ? reescrito : arquivoBanco;
    const sistema = pendente.origem === "sistema" ? reescrito : arquivoSistema;
    setArquivoBanco(banco);
    setArquivoSistema(sistema);
    setPendente(null);
    void conciliarExtratos(banco, sistema);
  }

  function subirOutro() {
    if (!pendente) return;
    if (pendente.origem === "banco") setArquivoBanco(null);
    else setArquivoSistema(null);
    setPendente(null);
  }

  async function enviarEConciliar(arquivoBanco: File, arquivoSistema: File) {
    const banco = await subir(arquivoBanco, "banco");
    if (!banco.ok) return falhar(banco);
    const sistema = await subir(arquivoSistema, "sistema");
    if (!sistema.ok) return falhar(sistema);

    setEtapa("processando");
    const situacoes = await Promise.all([
      aguardarProcessamento(banco.dados.extratoId, () => vivo.current),
      aguardarProcessamento(sistema.dados.extratoId, () => vivo.current),
    ]);

    const recados: string[] = [];
    for (const situacao of situacoes) {
      if (situacao === null) {
        setEtapa("ocioso");
        setErro("O processamento demorou mais que o esperado. Tente de novo em instantes.");
        return;
      }
      if ("ok" in situacao) return falhar(situacao);
      if (situacao.status === "erro") {
        setEtapa("ocioso");
        setErro(motivoDaRecusa(situacao));
        return;
      }
      if (situacao.erros.length > 0) {
        // "concluido_com_erros": a conciliação segue, mas quem enviou precisa
        // saber que parte das linhas ficou de fora.
        recados.push(
          `${situacao.erros.length} linha(s) do extrato do ${situacao.origem} não foram lidas.`,
        );
      }
    }
    setAvisos(recados);

    setEtapa("conciliando");
    const resultado = await conciliar(banco.dados.extratoId, sistema.dados.extratoId);
    if (!resultado.ok) return falhar(resultado);

    // A listagem do resultado parte do extrato do banco (o do sistema seria
    // ambíguo, porque pode ter sido conciliado com vários extratos de banco), e
    // o do sistema vai junto para filtrar só as linhas deste par.
    router.push(caminhoDaConciliacao(banco.dados.extratoId, sistema.dados.extratoId));
  }

  const podeConciliar = arquivoBanco !== null && arquivoSistema !== null;
  const ocupado = etapa !== "ocioso";
  const falta =
    !arquivoBanco && !arquivoSistema
      ? "Envie os dois extratos para conciliar."
      : !arquivoBanco
        ? "Falta o extrato do banco."
        : "Falta o extrato do sistema de gestão.";

  if (pendente) {
    return (
      <div style={{ padding: "36px 0 64px" }}>
        <ImportacaoInterrompida
          nome={pendente.arquivo.name}
          origem={pendente.origem}
          analise={pendente.analise}
          onPronto={retomar}
          onOutroArquivo={subirOutro}
        />
      </div>
    );
  }

  return (
    <div className="nova-tela">
      {/* o mês só se sabe depois de ler as datas dos extratos: a linha fica só com a empresa */}
      <Cabecalho titulo="Nova conciliação" contexto={[]} />
      <div className="nova-corpo">
        {ocupado && arquivoBanco && arquivoSistema ? (
          <Casamento banco={arquivoBanco.name} sistema={arquivoSistema.name} etapa={etapa} />
        ) : (
          <Reveal>
            {/* o encaixe (globals.css): cada lado acende quando o seu extrato entra, e o elo do meio
                quando entraram os dois */}
            <div
              className="nova-encaixe"
              data-banco={arquivoBanco ? "pronto" : "vazio"}
              data-sistema={arquivoSistema ? "pronto" : "vazio"}
            >
              <CartaoDeExtrato
                titulo="Extrato do banco"
                dica="Arquivo OFX ou CSV exportado do internet banking"
                accept=".ofx,.csv"
                formatos="OFX ou CSV"
                arquivo={arquivoBanco}
                onArquivo={(arquivo) => escolher("banco", arquivo)}
                onRecusado={setErro}
              />
              <span className="nova-elo" aria-hidden="true">
                <span className="nova-elo-traco nova-elo-traco-banco" />
                <span className="nova-elo-no">
                  <Link2 />
                </span>
                <span className="nova-elo-traco nova-elo-traco-sistema" />
              </span>
              <CartaoDeExtrato
                titulo="Extrato do sistema de gestão"
                dica="Arquivo CSV exportado do seu sistema de gestão"
                accept=".csv"
                formatos="CSV"
                arquivo={arquivoSistema}
                onArquivo={(arquivo) => escolher("sistema", arquivo)}
                onRecusado={setErro}
              />
            </div>
          </Reveal>
        )}

        {/* o ciclo, dito antes do envio: o Ledgr só lê e confere, quem corrige é a pessoa, no
            próprio sistema, e cada nova versão do extrato do sistema vira uma rodada */}
        <Reveal delay={0.08} className="card nova-como-funciona">
          <section aria-labelledby="nova-como-funciona-titulo">
            <h2 id="nova-como-funciona-titulo" className="font-titulo nova-como-titulo">
              Como funciona
            </h2>
            <p className="nova-como-subtitulo">Três passos, a cada mês.</p>
            <ol className="nova-passos">
              <li>
                <span className="nova-passo-numero" aria-hidden="true">
                  1
                </span>
                <strong>Envie os dois extratos</strong>
                <span>O do banco e o do seu sistema de gestão, do mesmo período.</span>
              </li>
              <li>
                <span className="nova-passo-numero" aria-hidden="true">
                  2
                </span>
                <strong>Confira e aponte</strong>
                <span>Marque o que conferiu e justifique o que fica como está.</span>
              </li>
              <li>
                <span className="nova-passo-numero" aria-hidden="true">
                  3
                </span>
                <strong>Corrija no seu sistema e envie de novo</strong>
                <span>Cada nova versão do extrato do sistema vira uma rodada.</span>
              </li>
            </ol>
            <div className="nova-notas">
              <p className="nova-nota nova-nota-destaque">
                <ShieldCheck aria-hidden="true" />
                <span>O Ledgr não altera nada no seu banco nem no seu sistema: ele só lê os extratos e confere.</span>
              </p>
              <p className="nova-nota">
                <Scale aria-hidden="true" />
                <span>
                  O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como
                  &ldquo;o sistema diverge do banco&rdquo;. Se o valor no seu sistema estiver diferente,
                  é ele que precisa de ajuste.
                </span>
              </p>
            </div>
          </section>
        </Reveal>

        {erro && (
          <p role="alert" className="selo selo-risco" style={{ marginBottom: 20 }}>
            {erro}
          </p>
        )}

        {avisos.length > 0 && (
          <ul style={{ margin: "0 0 20px", paddingLeft: 18, fontSize: 14 }}>
            {avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 16px" }}>
          <button
            type="button"
            className="btn nova-conciliar"
            disabled={!podeConciliar || ocupado}
            aria-describedby={podeConciliar ? undefined : "nova-conciliacao-pendente"}
            onClick={() => void conciliarExtratos()}
          >
            {ocupado ? "Conciliando…" : "Conciliar extratos"}
            {!ocupado && <ArrowRight aria-hidden="true" />}
          </button>
          {ocupado && (
            <span
              aria-live="polite"
              style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}
            >
              {RECADO[etapa]}
            </span>
          )}
          {!podeConciliar && !ocupado && (
            <span
              id="nova-conciliacao-pendente"
              style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}
            >
              {falta}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Uma área de soltar: o cartão é o rótulo de um input de arquivo invisível, então clicar em
 * qualquer lugar dele abre a escolha, e "Trocar arquivo" é só o aviso de que dá para escolher de
 * novo. O que é solto em cima não passa pelo accept do input: a extensão é conferida aqui.
 */
function CartaoDeExtrato({
  titulo,
  dica,
  accept,
  formatos,
  arquivo,
  onArquivo,
  onRecusado,
}: {
  titulo: string;
  dica: string;
  accept: string;
  /** Como o accept aparece no recado de arquivo recusado ("OFX ou CSV"). */
  formatos: string;
  arquivo: File | null;
  onArquivo: (arquivo: File) => void;
  onRecusado: (recado: string) => void;
}) {
  const [arrastando, setArrastando] = useState(false);

  function aoSoltar(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setArrastando(false);
    const solto = event.dataTransfer.files[0];
    if (!solto) return;
    const nome = solto.name.toLowerCase();
    if (!accept.split(",").some((extensao) => nome.endsWith(extensao))) {
      onRecusado(`O ${titulo.toLowerCase()} precisa ser um arquivo ${formatos}.`);
      return;
    }
    onArquivo(solto);
  }

  return (
    <label
      className="card cartao-arquivo"
      data-pronto={arquivo ? "" : undefined}
      data-arrastando={arrastando ? "" : undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(event) => {
        // sair do cartão para um filho dele também dispara o dragleave
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setArrastando(false);
      }}
      onDrop={aoSoltar}
    >
      <span className="cartao-arquivo-icone" aria-hidden="true">
        {arquivo ? <Check /> : <FileUp />}
      </span>
      <span className="font-titulo cartao-arquivo-titulo">{titulo}</span>
      {arquivo ? (
        <>
          <span className="cartao-arquivo-nome">{arquivo.name}</span>
          <span className="cartao-arquivo-meta">
            <span>{tamanho(arquivo.size)}</span> · <span className="cartao-arquivo-trocar">Trocar arquivo</span>
          </span>
        </>
      ) : (
        <>
          <span className="cartao-arquivo-dica">{dica}</span>
          <span className="cartao-arquivo-acao">Arraste o arquivo ou clique para escolher</span>
        </>
      )}
      <input
        aria-label={titulo}
        className="cartao-arquivo-input"
        type="file"
        accept={accept}
        onChange={(event) => {
          // cancelar a janela de escolha não apaga o arquivo que já estava
          const escolhido = event.target.files?.[0];
          if (escolhido) onArquivo(escolhido);
        }}
      />
    </label>
  );
}

// as etapas do envio na ordem em que acontecem (envio.ts)
const ETAPAS: Etapa[] = ["conferindo", "enviando", "processando", "conciliando"];
// as larguras das linhas de mentira, do banco e do sistema: parecidas, nunca iguais
const PARES = [
  [72, 64],
  [88, 92],
  [58, 70],
  [80, 74],
];

/**
 * No envio, os cartões dão lugar ao casamento: linhas do banco e do sistema que se aproximam e
 * ganham o ✓, uma depois da outra, enquanto a barra de baixo anda com a etapa real. As linhas são
 * só ilustração (o progresso de verdade é a etapa, anunciada ao lado do botão).
 */
function Casamento({ banco, sistema, etapa }: { banco: string; sistema: string; etapa: Etapa }) {
  const indice = ETAPAS.indexOf(etapa) + 1;
  return (
    <div className="card nova-casamento">
      <div className="nova-casamento-topo">
        <span className="nova-casamento-lado">
          <small>Banco</small>
          <span>{banco}</span>
        </span>
        <span className="nova-casamento-lado nova-casamento-lado-sistema">
          <small>Sistema de gestão</small>
          <span>{sistema}</span>
        </span>
      </div>
      <div className="nova-pares" aria-hidden="true">
        {PARES.map(([larguraBanco, larguraSistema], i) => (
          <div key={i} className="nova-par" style={{ "--i": i } as CSSProperties}>
            <span className="nova-par-banco" style={{ width: `${larguraBanco}%` }} />
            <Check className="nova-par-check" />
            <span className="nova-par-sistema" style={{ width: `${larguraSistema}%` }} />
          </div>
        ))}
      </div>
      <div className="nova-etapas">
        <span className="nova-etapas-barra" aria-hidden="true">
          {ETAPAS.map((nome, i) => (
            <span key={nome} data-feita={i < indice ? "" : undefined} />
          ))}
        </span>
        <span className="nova-etapas-texto">{`Etapa ${indice} de ${ETAPAS.length}`}</span>
      </div>
    </div>
  );
}

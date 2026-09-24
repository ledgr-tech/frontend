"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  conciliar,
  enviarExtrato,
  situacaoDoExtrato,
  type Falha,
  type SituacaoExtrato,
} from "../acoes";

/**
 * Conferido antes de subir. Abaixo dos 5MB do backend de propósito: o arquivo
 * passa por uma Server Action, e a Vercel corta o corpo da requisição em 4,5MB
 * (o `bodySizeLimit` do next.config.ts acompanha esse teto).
 */
const TAMANHO_MAXIMO_BYTES = 4 * 1024 * 1024;

// A Server Action lançou em vez de devolver um Resultado: corpo grande demais,
// rede caída ou deploy novo no meio ("Failed to find Server Action"). Recarregar
// resolve os dois últimos.
const ERRO_SEM_RESPOSTA = "Não foi possível enviar agora. Recarregue a página e tente de novo.";

// O upload responde na hora com `status: "pendente"` e o parsing roda em
// background, então o resultado só aparece consultando de novo.
const INTERVALO_CONSULTA_MS = 1500;
const ESPERA_MAXIMA_MS = 90_000;

const TERMINAIS: readonly SituacaoExtrato["status"][] = [
  "concluido",
  "concluido_com_erros",
  "erro",
];

type Etapa = "ocioso" | "enviando" | "processando" | "conciliando";

const RECADO: Record<Exclude<Etapa, "ocioso">, string> = {
  enviando: "Enviando os extratos…",
  processando: "Lendo os lançamentos…",
  conciliando: "Comparando banco e sistema…",
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function NovaConciliacaoPage() {
  const router = useRouter();
  const [arquivoBanco, setArquivoBanco] = useState<File | null>(null);
  const [arquivoSistema, setArquivoSistema] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  // para o laço de consulta se a pessoa sair da tela no meio do processamento
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  function selecionarBanco(event: ChangeEvent<HTMLInputElement>) {
    setErro(null);
    setArquivoBanco(event.target.files?.[0] ?? null);
  }

  function selecionarSistema(event: ChangeEvent<HTMLInputElement>) {
    setErro(null);
    setArquivoSistema(event.target.files?.[0] ?? null);
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

  async function subir(arquivo: File, origem: "banco" | "sistema") {
    const dados = new FormData();
    dados.append("arquivo", arquivo);
    // O campo que trava a integração (issue #20): obrigatório e sem default no
    // backend — ausente, o FastAPI devolve 422 antes de olhar o arquivo.
    dados.append("origem", origem);
    return enviarExtrato(dados);
  }

  /** Consulta até o parsing terminar. Devolve null se desistiu de esperar. */
  async function aguardarProcessamento(extratoId: string): Promise<SituacaoExtrato | Falha | null> {
    const limite = Date.now() + ESPERA_MAXIMA_MS;
    while (Date.now() < limite) {
      const resposta = await situacaoDoExtrato(extratoId);
      if (!resposta.ok) return resposta;
      if (TERMINAIS.includes(resposta.dados.status)) return resposta.dados;
      if (!vivo.current) return null;
      await esperar(INTERVALO_CONSULTA_MS);
    }
    return null;
  }

  async function conciliarExtratos() {
    if (!arquivoBanco || !arquivoSistema || etapa !== "ocioso") return;

    const grande = [arquivoBanco, arquivoSistema].find(
      (arquivo) => arquivo.size > TAMANHO_MAXIMO_BYTES,
    );
    if (grande) {
      // sem isso, o arquivo inteiro sobe só pra requisição ser recusada no caminho
      setErro(`O arquivo "${grande.name}" passa de 4MB. Exporte um período menor.`);
      return;
    }

    setErro(null);
    setAvisos([]);
    setEtapa("enviando");

    try {
      await enviarEConciliar(arquivoBanco, arquivoSistema);
    } catch {
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    }
  }

  async function enviarEConciliar(arquivoBanco: File, arquivoSistema: File) {
    const banco = await subir(arquivoBanco, "banco");
    if (!banco.ok) return falhar(banco);
    const sistema = await subir(arquivoSistema, "sistema");
    if (!sistema.ok) return falhar(sistema);

    setEtapa("processando");
    const situacoes = await Promise.all([
      aguardarProcessamento(banco.dados.extratoId),
      aguardarProcessamento(sistema.dados.extratoId),
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
        setErro(`Não foi possível ler o extrato do ${situacao.origem}.`);
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

    // A listagem do resultado parte do extrato do banco: o do sistema seria
    // ambíguo, porque pode ter sido conciliado com vários extratos de banco.
    router.push(`/conciliacoes/${banco.dados.extratoId}`);
  }

  const podeConciliar = arquivoBanco !== null && arquivoSistema !== null;
  const ocupado = etapa !== "ocioso";

  return (
    <div style={{ padding: "36px 0 64px", maxWidth: 1040 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 30, fontWeight: 600 }}>Nova conciliação</h1>
      <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
        Setembro/2026
      </span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 20,
          margin: "24px 0",
        }}
      >
        <label
          className="card cartao-arquivo"
          style={{ position: "relative", cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do banco
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            {arquivoBanco ? arquivoBanco.name : "Arquivo OFX ou CSV exportado do internet banking"}
          </span>
          <input
            aria-label="Extrato do banco"
            type="file"
            accept=".ofx,.csv"
            disabled={ocupado}
            onChange={selecionarBanco}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
        <label
          className="card cartao-arquivo"
          style={{ position: "relative", cursor: "pointer", alignItems: "center", textAlign: "center", padding: "32px 20px" }}
        >
          <span style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 600 }}>
            Extrato do sistema de gestão
          </span>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 66%, transparent)" }}>
            {arquivoSistema ? arquivoSistema.name : "Arquivo CSV exportado do seu sistema de gestão"}
          </span>
          <input
            aria-label="Extrato do sistema de gestão"
            type="file"
            accept=".csv"
            disabled={ocupado}
            onChange={selecionarSistema}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
      </div>

      <div className="card" style={{ borderColor: "var(--color-accent)", marginBottom: 28 }}>
        <h6 style={{ margin: "0 0 8px", color: "var(--color-accent-700)" }}>Regra de ouro</h6>
        <p style={{ margin: 0, fontSize: 14 }}>
          O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como
          &ldquo;o sistema diverge do banco&rdquo; — se o valor no seu sistema estiver diferente,
          é ele que precisa de ajuste.
        </p>
      </div>

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
          className="btn btn-primary"
          disabled={!podeConciliar || ocupado}
          aria-describedby={podeConciliar ? undefined : "nova-conciliacao-pendente"}
          onClick={() => void conciliarExtratos()}
          style={{ fontSize: 15, padding: "12px 22px" }}
        >
          {ocupado ? "Conciliando…" : "Conciliar extratos"}
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
            Envie os dois extratos para conciliar.
          </span>
        )}
      </div>
    </div>
  );
}

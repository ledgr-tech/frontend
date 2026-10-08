"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
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
    <div>
      {/* o mês só se sabe depois de ler as datas dos extratos: a linha fica só com a empresa */}
      <Cabecalho titulo="Nova conciliação" contexto={[]} />
      <div style={{ padding: "8px 0 64px" }}>

        <Reveal
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
            <span className="font-titulo" style={{ fontSize: 20, fontWeight: 600 }}>
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
            <span className="font-titulo" style={{ fontSize: 20, fontWeight: 600 }}>
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
        </Reveal>

        <Reveal delay={0.08} className="card" style={{ marginBottom: 28 }}>
          <h6 style={{ margin: "0 0 8px" }}>Regra de ouro</h6>
          <p style={{ margin: 0, fontSize: 14 }}>
            O extrato do banco é sempre a fonte da verdade. Toda divergência aparece como
            &ldquo;o sistema diverge do banco&rdquo;. Se o valor no seu sistema estiver diferente,
            é ele que precisa de ajuste.
          </p>
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
    </div>
  );
}

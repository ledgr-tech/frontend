"use client";

import Link from "@/lib/link-do-app";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { formatarDataHora } from "../../dashboard/resumo";
import { useRoteador } from "@/lib/roteador";
import { extratoGrandeDemais, TAMANHO_MAXIMO_UPLOAD_BYTES } from "@/lib/limite-de-upload";
import { conciliar, type Falha, type SituacaoExtrato } from "../acoes";
import {
  aguardarProcessamento,
  conferirCsv,
  ERRO_SEM_RESPOSTA,
  motivoDaRecusa,
  RECADO,
  subir,
  type Etapa,
  type Pendente,
} from "../envio";
import { ImportacaoInterrompida } from "../nova/importacao-interrompida";
import { LinhasNaoLidas } from "../linhas-nao-lidas";
import { carregarPromptIa, importarViaIa, type FalhaDaImportacao, type PromptDaIa } from "../nova/ia/acoes";
import { ErrosImportacaoIa } from "../nova/ia/erros-importacao-ia";
import { PromptIa } from "../nova/ia/prompt-ia";

function tamanhoEmKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
}

/**
 * A nova versão do extrato do sistema, enviada da própria comparação: a pessoa
 * corrigiu o sistema de gestão e concilia de novo com o mesmo extrato do banco. É
 * a rodada seguinte da conciliação (spec 2026-10-02-conciliacao-em-rodadas). Janela
 * nativa com showModal, como a da linha; enquanto envia, ela não fecha.
 */
export function NovaVersao({
  extratoBancoId,
  extratoSistemaId,
  rodadaAtual,
  onConcluida,
}: {
  extratoBancoId: string;
  extratoSistemaId?: string;
  /** A rodada que vale hoje e quantas a conciliação já teve; sem ela (o mock), a janela não mostra o "de → para". */
  rodadaAtual?: { numero: number; total: number; arquivo: string; em: string };
  /** A rodada nova existe: a tela recarrega nela. */
  onConcluida: () => void;
}) {
  const router = useRoteador();
  const [aberta, setAberta] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [erroIa, setErroIa] = useState<FalhaDaImportacao | null>(null);
  const [mostrarPrompt, setMostrarPrompt] = useState(false);
  const [prompt, setPrompt] = useState<PromptDaIa | null>(null);
  const [carregandoPrompt, setCarregandoPrompt] = useState(false);
  const [erroPrompt, setErroPrompt] = useState<string | null>(null);
  // 402: o teste acabou (spec 2026-10-15-primeiro-uso); o motivo vem com o caminho para os planos
  const [semPlano, setSemPlano] = useState(false);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [parcial, setParcial] = useState<{ extratoId: string; erros: SituacaoExtrato["erros"] } | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  // trava também os cliques que chegam antes do próximo render
  const emAndamento = useRef(false);
  // para o laço de consulta se a tela sair no meio do processamento
  const vivo = useRef(true);
  const ocupado = etapa !== "ocioso";

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!aberta || !elemento || elemento.open) return;
    if (typeof elemento.showModal === "function") elemento.showModal();
    // sem showModal (navegador antigo, jsdom): abre do mesmo jeito
    else elemento.setAttribute("open", "");
  }, [aberta]);

  function fechar() {
    if (emAndamento.current) return;
    setAberta(false);
    setArquivo(null);
    setErro(null);
    setPendente(null);
    setParcial(null);
    setErroIa(null);
    setMostrarPrompt(false);
    setSemPlano(false);
  }

  function falhar(falha: Falha) {
    // 401 é sessão expirada: de volta pro login, em vez de um erro na janela
    if (falha.status === 401) {
      router.push("/login");
      return;
    }
    setEtapa("ocioso");
    setErro(falha.erro);
  }

  function escolher(escolhido: File) {
    if (emAndamento.current) return;
    setErro(null);
    setErroIa(null);
    setSemPlano(false);
    if (!/\.(csv|json)$/i.test(escolhido.name)) {
      setArquivo(null);
      setErro("Escolha um arquivo CSV ou JSON.");
    } else if (escolhido.size > TAMANHO_MAXIMO_UPLOAD_BYTES) {
      setArquivo(null);
      setErro(extratoGrandeDemais(escolhido.name));
    } else {
      setArquivo(escolhido);
    }
  }

  async function carregarInstrucoes() {
    if (carregandoPrompt || prompt) return;
    setCarregandoPrompt(true);
    setErroPrompt(null);
    try {
      const resultado = await carregarPromptIa();
      if (!vivo.current) return;
      if (resultado.ok) setPrompt(resultado.dados);
      else setErroPrompt(resultado.erro);
    } catch {
      if (vivo.current) setErroPrompt(ERRO_SEM_RESPOSTA);
    } finally {
      if (vivo.current) setCarregandoPrompt(false);
    }
  }

  async function revisarJson(escolhido: File) {
    setEtapa("enviando");
    const dados = new FormData();
    dados.append("arquivo", escolhido);
    const resultado = await importarViaIa(dados);
    if (!vivo.current) return;
    if (!resultado.ok) {
      if (resultado.erros.length && resultado.status !== 401) {
        setErroIa(resultado);
        setEtapa("ocioso");
        return;
      }
      falhar(resultado);
      return;
    }

    const busca = new URLSearchParams({ banco: extratoBancoId });
    if (extratoSistemaId) busca.set("sistemaAnterior", extratoSistemaId);
    setAberta(false);
    setArquivo(null);
    setMostrarPrompt(false);
    setEtapa("ocioso");
    router.push(`/conciliacoes/nova/ia/${resultado.dados.importacaoId}?${busca}`);
  }

  async function enviar(escolhido = arquivo) {
    if (!escolhido || emAndamento.current || parcial) return;
    if (escolhido.size > TAMANHO_MAXIMO_UPLOAD_BYTES) {
      setErro(extratoGrandeDemais(escolhido.name));
      return;
    }
    emAndamento.current = true;
    setErro(null);
    setErroIa(null);
    setSemPlano(false);
    try {
      if (/\.json$/i.test(escolhido.name)) {
        await revisarJson(escolhido);
        return;
      }
      setEtapa("conferindo");
      const conferido = await conferirCsv(escolhido, "sistema");
      if (!vivo.current) return;
      if (!conferido.pronto) {
        setEtapa("ocioso");
        if ("erro" in conferido) setErro(conferido.erro);
        else setPendente(conferido.pendente);
        return;
      }

      setEtapa("enviando");
      const enviado = await subir(escolhido, "sistema");
      if (!vivo.current) return;
      if (!enviado.ok) return falhar(enviado);

      setEtapa("processando");
      const situacao = await aguardarProcessamento(enviado.dados.extratoId, () => vivo.current);
      if (!vivo.current) return;
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
      if (situacao.status === "concluido_com_erros") {
        // A rodada só nasce depois da decisão; continuar reutiliza este upload.
        setParcial({ extratoId: enviado.dados.extratoId, erros: situacao.erros });
        setEtapa("ocioso");
        return;
      }
      await concluirExtrato(enviado.dados.extratoId);
    } catch {
      if (!vivo.current) return;
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    } finally {
      emAndamento.current = false;
    }
  }

  async function concluirExtrato(extratoId: string) {
    setEtapa("conciliando");
    const resultado = await conciliar(extratoBancoId, extratoId);
    if (!vivo.current) return;
    setSemPlano(!resultado.ok && resultado.status === 402);
    if (!resultado.ok) return falhar(resultado);

    setEtapa("ocioso");
    setAberta(false);
    setArquivo(null);
    setParcial(null);
    onConcluida();
  }

  async function continuarComLinhasValidas() {
    if (!parcial || emAndamento.current) return;
    emAndamento.current = true;
    setErro(null);
    setSemPlano(false);
    try {
      await concluirExtrato(parcial.extratoId);
    } catch {
      if (!vivo.current) return;
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    } finally {
      emAndamento.current = false;
    }
  }

  const recados = (
    <>
      {erro && <p role="alert" className="selo selo-risco nova-versao-erro">{erro}</p>}
      {erro && semPlano && <Link href="/assinatura" className="btn btn-secondary">Ver os planos</Link>}
      {ocupado && <p aria-live="polite" className="dialog-body">{RECADO[etapa]}</p>}
    </>
  );

  return (
    <>
      {/* a ação que fecha o ciclo da conciliação: em destaque, com o texto curto; o nome inteiro fica para o leitor de tela */}
      <button
        type="button"
        className="btn btn-primary nova-versao-botao"
        aria-label="Enviar nova versão do extrato do sistema"
        onClick={() => setAberta(true)}
      >
        <Upload size={17} aria-hidden="true" />
        Enviar nova versão
      </button>
      {aberta && (
        <dialog
          ref={dialogo}
          className="espia nova-versao modal-suave"
          aria-labelledby="nova-versao-titulo"
          onKeyDown={(evento) => {
            if (evento.key !== "Escape") return;
            evento.preventDefault();
            fechar();
          }}
          onCancel={(evento) => {
            evento.preventDefault();
            fechar();
          }}
          onClose={fechar}
        >
          <div className="dialog">
            <span id="nova-versao-titulo" className="dialog-title">
              Nova versão do extrato do sistema
            </span>
            {pendente ? (
              <ImportacaoInterrompida
                nome={pendente.arquivo.name}
                origem="sistema"
                analise={pendente.analise}
                onPronto={(reescrito) => {
                  setPendente(null);
                  setArquivo(reescrito);
                  void enviar(reescrito);
                }}
                onOutroArquivo={() => {
                  setPendente(null);
                  setArquivo(null);
                }}
              />
            ) : parcial ? (
              <>
                <LinhasNaoLidas origem="sistema" erros={parcial.erros} />
                <p className="dialog-body">
                  A nova rodada usará somente as linhas válidas. Volte para corrigir o arquivo ou confirme que deseja continuar sem as linhas rejeitadas.
                  Se voltar ou fechar, o arquivo enviado fica em Extratos, sem conciliação.
                </p>
                {recados}
                {/* a chave monta botões novos: sem ela, o React reaproveitaria o "Enviar e conciliar" focado como
                    "Continuar", e um Enter a mais concluiria sem a pessoa ler; o foco vai para a saída que não concilia */}
                <div className="dialog-actions" key="decisao">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={ocupado}
                    autoFocus
                    onClick={() => {
                      if (emAndamento.current) return;
                      setParcial(null);
                      setArquivo(null);
                      setErro(null);
                      setSemPlano(false);
                    }}
                  >
                    Voltar para corrigir
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary nova-versao-enviar"
                    disabled={ocupado}
                    aria-busy={ocupado}
                    onClick={() => void continuarComLinhasValidas()}
                  >
                    Continuar com linhas válidas
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="dialog-body">
                  O extrato do banco continua o mesmo. O Ledgr concilia de novo e a tela abre na rodada nova.
                </p>
                {/* de onde para onde: a rodada que vale hoje e a que este arquivo vai abrir */}
                {rodadaAtual && (
                  <div className="nova-versao-rodadas">
                    <div className="nova-versao-rodada">
                      <span className="nova-versao-rodada-rotulo">{`Rodada ${rodadaAtual.numero} · agora`}</span>
                      <span className="nova-versao-rodada-arquivo">{rodadaAtual.arquivo}</span>
                      <span className="nova-versao-rodada-detalhe">{formatarDataHora(rodadaAtual.em)}</span>
                    </div>
                    <ArrowRight size={20} aria-hidden="true" className="nova-versao-seta" />
                    <div className="nova-versao-rodada" data-nova="true">
                      <span className="nova-versao-rodada-rotulo">{`Rodada ${rodadaAtual.total + 1} · nova`}</span>
                      <span className="nova-versao-rodada-arquivo">{arquivo ? arquivo.name : "O arquivo corrigido"}</span>
                      <span className="nova-versao-rodada-detalhe">
                        {arquivo ? `${tamanhoEmKb(arquivo.size)} · pronto para enviar` : "Escolha abaixo"}
                      </span>
                    </div>
                  </div>
                )}
                <label
                  className="nova-versao-soltar"
                  data-arrastando={arrastando || undefined}
                  onDragOver={(evento) => {
                    evento.preventDefault();
                    if (!ocupado) setArrastando(true);
                  }}
                  onDragLeave={() => setArrastando(false)}
                  onDrop={(evento) => {
                    evento.preventDefault();
                    setArrastando(false);
                    const solto = evento.dataTransfer.files?.[0];
                    if (solto) escolher(solto);
                  }}
                >
                  <Upload size={24} aria-hidden="true" className="nova-versao-soltar-icone" />
                  <span className="nova-versao-soltar-texto">
                    <strong>{arquivo ? "Trocar o arquivo" : "Solte aqui o arquivo corrigido"}</strong>
                    <span>{arquivo ? `${arquivo.name} · solte outro ou clique` : "ou clique para escolher"}</span>
                  </span>
                  <input
                    type="file"
                    accept=".csv,.json"
                    className="sr-only"
                    aria-label="Extrato do sistema de gestão"
                    aria-describedby="nova-versao-formatos"
                    disabled={ocupado}
                    onChange={(evento) => {
                      const escolhido = evento.target.files?.[0];
                      if (escolhido) escolher(escolhido);
                      evento.target.value = "";
                    }}
                  />
                </label>
                <p id="nova-versao-formatos" className="dialog-body">CSV ou JSON, até 4 MB.</p>
                <div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    aria-expanded={mostrarPrompt}
                    disabled={ocupado}
                    onClick={() => {
                      setMostrarPrompt(!mostrarPrompt);
                      if (!mostrarPrompt) void carregarInstrucoes();
                    }}
                  >
                    Gerar JSON com IA
                  </button>
                </div>
                {mostrarPrompt && (
                  <>
                    <p className="dialog-body">Copie o prompt, cole na IA que você usa e anexe o PDF do relatório. Envie aqui o JSON que ela devolver.</p>
                    {carregandoPrompt && <p role="status" className="dialog-body">Carregando o prompt…</p>}
                    {erroPrompt && (
                      <div>
                        <p role="alert" className="dialog-body">{erroPrompt}</p>
                        <button type="button" className="btn btn-secondary" onClick={() => void carregarInstrucoes()}>
                          Tentar carregar o prompt
                        </button>
                      </div>
                    )}
                    {prompt && <PromptIa prompt={prompt.prompt} />}
                  </>
                )}
                {erroIa && <ErrosImportacaoIa erro={erroIa.erro} erros={erroIa.erros} totalErros={erroIa.totalErros} />}
                {recados}
                <div className="dialog-actions">
                  <button type="button" className="btn btn-secondary" onClick={fechar} disabled={ocupado}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary nova-versao-enviar"
                    disabled={!arquivo || ocupado}
                    aria-busy={ocupado}
                    onClick={() => void enviar()}
                  >
                    {arquivo && /\.json$/i.test(arquivo.name) ? "Importar e conferir" : "Enviar e conciliar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}

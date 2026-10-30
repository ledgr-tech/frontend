"use client";

import Link from "@/lib/link-do-app";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { formatarDataHora } from "../../dashboard/resumo";
import { useRoteador } from "@/lib/roteador";
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
  type Pendente,
} from "../envio";
import { ImportacaoInterrompida } from "../nova/importacao-interrompida";

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
  rodadaAtual,
  onConcluida,
}: {
  extratoBancoId: string;
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
  // 402: o teste acabou (spec 2026-10-15-primeiro-uso); o motivo vem com o caminho para os planos
  const [semPlano, setSemPlano] = useState(false);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
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
    if (ocupado) return;
    setAberta(false);
    setArquivo(null);
    setErro(null);
    setPendente(null);
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

  async function enviar(escolhido = arquivo) {
    if (!escolhido) return;
    if (escolhido.size > TAMANHO_MAXIMO_BYTES) {
      setErro(`O arquivo "${escolhido.name}" passa de 4MB. Exporte um período menor.`);
      return;
    }
    setErro(null);
    setEtapa("conferindo");
    try {
      const conferido = await conferirCsv(escolhido, "sistema");
      if (!conferido.pronto) {
        setEtapa("ocioso");
        if ("erro" in conferido) setErro(conferido.erro);
        else setPendente(conferido.pendente);
        return;
      }

      setEtapa("enviando");
      const enviado = await subir(escolhido, "sistema");
      if (!enviado.ok) return falhar(enviado);

      setEtapa("processando");
      const situacao = await aguardarProcessamento(enviado.dados.extratoId, () => vivo.current);
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

      setEtapa("conciliando");
      const resultado = await conciliar(extratoBancoId, enviado.dados.extratoId);
      setSemPlano(!resultado.ok && resultado.status === 402);
      if (!resultado.ok) return falhar(resultado);

      setEtapa("ocioso");
      setAberta(false);
      setArquivo(null);
      onConcluida();
    } catch {
      setEtapa("ocioso");
      setErro(ERRO_SEM_RESPOSTA);
    }
  }

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
                    if (ocupado || !solto) return;
                    setErro(null);
                    setArquivo(solto);
                  }}
                >
                  <Upload size={24} aria-hidden="true" className="nova-versao-soltar-icone" />
                  <span className="nova-versao-soltar-texto">
                    <strong>{arquivo ? "Trocar o arquivo" : "Solte aqui o CSV corrigido"}</strong>
                    <span>{arquivo ? `${arquivo.name} · solte outro ou clique` : "ou clique para escolher · até 4MB"}</span>
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    aria-label="Extrato do sistema de gestão"
                    disabled={ocupado}
                    onChange={(evento) => {
                      setErro(null);
                      setArquivo(evento.target.files?.[0] ?? null);
                    }}
                  />
                </label>
                {erro && (
                  <p role="alert" className="selo selo-risco nova-versao-erro">
                    {erro}
                  </p>
                )}
                {erro && semPlano && (
                  <Link href="/plano" className="btn btn-secondary">
                    Ver os planos
                  </Link>
                )}
                {ocupado && (
                  <p aria-live="polite" className="dialog-body">
                    {RECADO[etapa]}
                  </p>
                )}
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
                    Enviar e conciliar
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

/**
 * A nova versão do extrato do sistema, enviada da própria comparação: a pessoa
 * corrigiu o sistema de gestão e concilia de novo com o mesmo extrato do banco. É
 * a rodada seguinte da conciliação (spec 2026-10-02-conciliacao-em-rodadas). Janela
 * nativa com showModal, como a da linha; enquanto envia, ela não fecha.
 */
export function NovaVersao({
  extratoBancoId,
  onConcluida,
}: {
  extratoBancoId: string;
  /** A rodada nova existe: a tela recarrega nela. */
  onConcluida: () => void;
}) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
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
      <button type="button" className="btn btn-secondary" onClick={() => setAberta(true)}>
        Enviar nova versão do extrato do sistema
      </button>
      {aberta && (
        <dialog
          ref={dialogo}
          className="espia nova-versao"
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
                  O Ledgr concilia de novo com o mesmo extrato do banco, e a tela abre na rodada nova.
                </p>
                <label className="nova-versao-campo">
                  <span>Extrato do sistema de gestão</span>
                  <input
                    type="file"
                    accept=".csv,.pdf"
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
                    className="btn btn-primary"
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

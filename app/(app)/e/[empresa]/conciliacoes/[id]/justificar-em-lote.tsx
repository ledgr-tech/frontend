"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";

const VAZIO = "Escreva o motivo da justificativa.";

/**
 * Justificar de uma vez as linhas selecionadas na comparação, com um texto só (backend #237, front #473),
 * no molde do `DecisaoEmLote`. `onJustificar` devolve o motivo de não ter gravado, ou null.
 */
export function JustificarEmLote({
  quantidade,
  jaJustificadas,
  limite = 500,
  onJustificar,
}: {
  quantidade: number;
  /** As selecionadas que já têm justificativa (valendo ou aguardando aprovação): a nova substitui. */
  jaJustificadas: number;
  limite?: number;
  onJustificar: (texto: string) => Promise<string | null>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // um envio por vez: o segundo clique antes do primeiro voltar não manda outro lote
  const travado = useRef(false);
  const idTexto = useId();
  const idNota = useId();
  const campo = useRef<HTMLTextAreaElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const cancelou = useRef(false);
  // o botão que abriu some: o foco vai ao campo, e volta ao botão no Cancelar, senão cairia no body
  // (depois de justificar, quem cuida do foco é a tela, que esvazia a seleção)
  useEffect(() => {
    if (aberto) campo.current?.focus();
    else if (cancelou.current) {
      cancelou.current = false;
      botao.current?.focus();
    }
  }, [aberto]);
  const acimaDoLimite = quantidade > limite;
  const rotulo = quantidade === 1 ? "Justificar a linha selecionada" : `Justificar as ${quantidade.toLocaleString("pt-BR")} linhas selecionadas`;

  async function enviar() {
    if (travado.current || acimaDoLimite) return;
    const motivo = texto.trim();
    if (!motivo) {
      setErro(VAZIO);
      return;
    }
    travado.current = true;
    setEnviando(true);
    setErro(null);
    let falha: string | null;
    try {
      falha = await onJustificar(motivo);
    } catch {
      // a Server Action lançou (rede caída, deploy novo no meio) em vez de devolver um Resultado
      falha = SEM_SERVIDOR;
    }
    travado.current = false;
    setEnviando(false);
    setErro(falha);
    if (falha === null) {
      setAberto(false);
      setTexto("");
    }
  }

  return (
    <>
      {acimaDoLimite && (
        <p className="vg-nota">{`Selecione no máximo ${limite.toLocaleString("pt-BR")} linhas para justificar de uma vez.`}</p>
      )}
      {aberto ? (
        <form
          className="lote-justificativa"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            void enviar();
          }}
        >
          <div className="field">
            <label htmlFor={idTexto}>Motivo da justificativa</label>
            <textarea
              id={idTexto}
              ref={campo}
              className="input"
              rows={2}
              maxLength={1000}
              required
              aria-describedby={idNota}
              value={texto}
              disabled={enviando}
              onChange={(evento) => setTexto(evento.target.value)}
            />
          </div>
          <p id={idNota} className="vg-nota">
            Fica no registro com o seu nome e o horário. Desfazer depois gera um novo registro.
            {jaJustificadas > 0 &&
              ` ${jaJustificadas === 1 ? "1 das selecionadas já tem" : `${jaJustificadas.toLocaleString("pt-BR")} das selecionadas já têm`} justificativa; a nova substitui a de antes.`}
          </p>
          <div className="fech-acoes">
            <button type="submit" className="btn btn-primary" disabled={enviando || acimaDoLimite} aria-busy={enviando || undefined}>
              Justificar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={enviando}
              onClick={() => {
                cancelou.current = true;
                setAberto(false);
                setErro(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="fech-acoes">
          <button ref={botao} type="button" className="btn btn-secondary" disabled={acimaDoLimite} onClick={() => setAberto(true)}>
            {rotulo}
          </button>
        </div>
      )}
      {erro && (
        <p role="alert" className="selo selo-risco fech-erro">
          {erro}
        </p>
      )}
    </>
  );
}

type Motivos = { naoEncontrada: number; naoDiverge: number; repetida: number; aprovada: number };

/**
 * O aviso depois de justificar em lote: quantas foram e, das que ficaram de fora, por quê. A repetida não
 * aparece: a tela manda cada chave uma vez, e o backend só a contaria por um pedido malformado.
 */
export function textoDoLote(processadas: number, motivos: Motivos): string {
  const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
  const porque = [
    motivos.aprovada > 0 && plural(motivos.aprovada, "já aprovada", "já aprovadas"),
    motivos.naoDiverge > 0 && plural(motivos.naoDiverge, "não diverge mais", "não divergem mais"),
    motivos.naoEncontrada > 0 && plural(motivos.naoEncontrada, "não existe mais nesta rodada", "não existem mais nesta rodada"),
  ].filter(Boolean);
  const fora = motivos.aprovada + motivos.naoDiverge + motivos.naoEncontrada;
  if (processadas === 0) return `Nenhuma linha foi justificada${porque.length ? `: ${porque.join(", ")}.` : "."}`;
  const feitas = `${plural(processadas, "linha justificada", "linhas justificadas")}.`;
  return fora > 0 ? `${feitas} ${fora.toLocaleString("pt-BR")} ${fora === 1 ? "ficou" : "ficaram"} de fora: ${porque.join(", ")}.` : feitas;
}
